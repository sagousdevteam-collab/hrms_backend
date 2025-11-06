import moment from 'moment';
import pool from '../config/db.js';
import { sendAttendanceReport, sendIndividualAttendanceReport } from '../utils/emailService.js';

// ✅ Calculate BOTH gross and net time
// ✅ CORRECT: Remove consecutive duplicate IN or OUT punches, then pair properly
const calculateBothTimes = (inLogs, outLogs) => {
    // Step 1: Combine all logs with their IDs and sort by ID (chronological order)
    const allLogs = [];
    
    inLogs.forEach(log => {
        allLogs.push({
            id: log.id,
            time: log.log_time,
            direction: 'in',
            timestamp: moment(log.log_time, 'HH:mm:ss'),
            rawLog: log
        });
    });
    
    outLogs.forEach(log => {
        allLogs.push({
            id: log.id,
            time: log.log_time,
            direction: 'out',
            timestamp: moment(log.log_time, 'HH:mm:ss'),
            rawLog: log
        });
    });
    
    // Sort by ID (NOT by time) - ID represents true chronological order
    allLogs.sort((a, b) => a.id - b.id);
    
    console.log(`      📊 Total logs: ${allLogs.length} (${inLogs.length} IN, ${outLogs.length} OUT)`);
    
    // Step 2: Remove consecutive duplicates based on direction
    const cleanedLogs = [];
    let lastDirection = null;
    
    for (const log of allLogs) {
        if (log.direction !== lastDirection) {
            cleanedLogs.push(log);
            lastDirection = log.direction;
        } else {
            console.log(`      ⚠️ Skipping duplicate ${log.direction.toUpperCase()} at ID ${log.id} (${log.timestamp.format('HH:mm')})`);
        }
    }
    
    const cleanedInCount = cleanedLogs.filter(l => l.direction === 'in').length;
    const cleanedOutCount = cleanedLogs.filter(l => l.direction === 'out').length;
    console.log(`      ✅ After cleaning: ${cleanedInCount} IN, ${cleanedOutCount} OUT`);
    
    // Step 3: Handle orphan OUT at start (from previous day)
    let startIndex = 0;
    if (cleanedLogs.length > 0 && cleanedLogs[0].direction === 'out') {
        console.log(`      ⚠️ First punch is OUT at ID ${cleanedLogs[0].id} (${cleanedLogs[0].timestamp.format('HH:mm')}) - skipping orphan`);
        startIndex = 1;
    }
    
    // Step 4: Pair IN→OUT sequentially by ID order
    let netMinutes = 0;
    const sessions = [];
    let inLog = null;
    
    for (let i = startIndex; i < cleanedLogs.length; i++) {
        const log = cleanedLogs[i];
        
        if (log.direction === 'in') {
            if (inLog) {
                // Multiple consecutive INs found (shouldn't happen after cleaning, but just in case)
                console.log(`      ⚠️ Unpaired IN at ID ${inLog.id} - closing session at next IN ID ${log.id}`);
            }
            inLog = log;
        } else if (log.direction === 'out' && inLog) {
            // Valid IN-OUT pair found
            const diffSeconds = log.timestamp.diff(inLog.timestamp, 'seconds');
            
            if (diffSeconds > 0) {
                const diffMinutes = Math.round(diffSeconds / 60);
                netMinutes += diffMinutes;
                
                sessions.push({
                    inId: inLog.id,
                    outId: log.id,
                    in: inLog.timestamp.format('HH:mm'),
                    out: log.timestamp.format('HH:mm'),
                    duration: `${Math.floor(diffMinutes / 60)}:${(diffMinutes % 60).toString().padStart(2, '0')}`,
                    minutes: diffMinutes
                });
                
                console.log(`      ✓ Paired: ID ${inLog.id} (${inLog.timestamp.format('HH:mm')}) → ID ${log.id} (${log.timestamp.format('HH:mm')}) = ${diffMinutes} min`);
            }
            
            inLog = null; // Reset for next pair
        } else if (log.direction === 'out' && !inLog) {
            // OUT without matching IN (orphan)
            console.log(`      ⚠️ Orphan OUT at ID ${log.id} (${log.timestamp.format('HH:mm')}) - no matching IN`);
        }
    }
    
    // Step 5: Handle unpaired IN at end (missing OUT punch)
    if (inLog) {
        const endOfDay = moment(inLog.timestamp).set({ hour: 23, minute: 59, second: 59 });
        const diffSeconds = endOfDay.diff(inLog.timestamp, 'seconds');
        const diffMinutes = Math.round(diffSeconds / 60);
        
        console.log(`      ⚠️ Missing OUT punch for IN at ID ${inLog.id} - assuming worked until ${endOfDay.format('HH:mm')}`);
        
        netMinutes += diffMinutes;
        sessions.push({
            inId: inLog.id,
            outId: null,
            in: inLog.timestamp.format('HH:mm'),
            out: endOfDay.format('HH:mm'),
            duration: `${Math.floor(diffMinutes / 60)}:${(diffMinutes % 60).toString().padStart(2, '0')}`,
            minutes: diffMinutes,
            incomplete: true
        });
    }
    
    // Step 6: Calculate GROSS time (first IN to last OUT)
    let grossMinutes = 0;
    if (sessions.length > 0) {
        const firstIn = moment(sessions[0].in, 'HH:mm');
        const lastOut = moment(sessions[sessions.length - 1].out, 'HH:mm');
        grossMinutes = lastOut.diff(firstIn, 'minutes');
        
        // Handle case where last session crosses midnight
        if (grossMinutes < 0) {
            grossMinutes += 24 * 60; // Add 24 hours
        }
    }
    
    const formatTime = (minutes) => {
        const hours = Math.floor(minutes / 60);
        const mins = minutes % 60;
        return `${hours}:${mins.toString().padStart(2, '0')}`;
    };
    
    console.log(`      📊 Final: NET ${formatTime(netMinutes)}, GROSS ${formatTime(grossMinutes)}, ${sessions.length} sessions`);
    
    return {
        netTime: formatTime(netMinutes),
        grossTime: formatTime(grossMinutes),
        breakTime: formatTime(Math.max(0, grossMinutes - netMinutes)),
        netMinutes,
        grossMinutes,
        sessions,
        totalPairs: sessions.length
    };
};

export const getAllAttendance = async (req, res) => {
    try {
        const { start_date, end_date, employee_code } = req.query;
        const role = req.user?.role_name;

        if (!['hr', 'manager', 'superadmin'].includes(role)) {
            return res.status(403).json({
                success: false,
                message: 'You do not have permission to view all attendance'
            });
        }

        const startDate = start_date || moment().startOf('month').format('YYYY-MM-DD');
        const endDate = end_date || moment().endOf('month').format('YYYY-MM-DD');

        let query = `SELECT employee_code, id, log_date, log_time, direction, log_date_time
                     FROM attendance_logs 
                     WHERE log_date BETWEEN ? AND ?`;
        let params = [startDate, endDate];

        if (employee_code) {
            query += ` AND employee_code = ?`;
            params.push(employee_code);
        }

        query += ` ORDER BY employee_code, log_date, id ASC`;

        const [logs] = await pool.query(query, params);

        res.json({
            success: true,
            data: logs,
            count: logs.length
        });
    } catch (error) {
        console.error('Attendance error:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching attendance',
            error: error.message
        });
    }
};

export const sendIndividualReports = async (req, res, daysAgo = 2) => {
    try {
        const reportDate = moment().subtract(daysAgo, 'days');
        const dateStr = reportDate.format('YYYY-MM-DD');

        console.log(`\n${'='.repeat(70)}`);
        console.log(`📅 Sending reports for: ${reportDate.format('DD MMMM YYYY')} (${dateStr})`);
        console.log(`${'='.repeat(70)}\n`);

        const [employees] = await pool.query(
            `SELECT 
                u.employee_id as employee_code,
                u.email,
                u.name,
                e.designation,
                e.id as emp_id
             FROM users u
             INNER JOIN employees e ON u.id = e.user_id
             WHERE u.email IS NOT NULL 
             AND u.email != ''
             AND e.is_active = TRUE`
        );

        if (employees.length === 0) {
            console.log('⚠️ No active employees found');
            if (res) {
                return res.json({ success: false, message: 'No active employees found' });
            }
            return;
        }

        console.log(`👥 Found ${employees.length} active employees\n`);

        let successCount = 0;
        let failCount = 0;
        let noDataCount = 0;

        for (const employee of employees) {
            try {
                console.log(`\n🔄 Processing: ${employee.name} (${employee.employee_code})`);

                const [logs] = await pool.query(
                    `SELECT log_time, direction, log_date_time, id
                     FROM attendance_logs
                     WHERE employee_code = ?
                     AND log_date = ?
                     ORDER BY id ASC`,
                    [employee.employee_code, dateStr]
                );

                if (logs.length === 0) {
                    console.log(`   ⚠️ No attendance logs`);
                    noDataCount++;
                    continue;
                }

                const inLogs = logs.filter(log => log.direction === 'in');
                const outLogs = logs.filter(log => log.direction === 'out');

                console.log(`   📊 ${logs.length} logs: ${inLogs.length} IN, ${outLogs.length} OUT`);

                // ✅ Calculate BOTH times
                const timeCalc = calculateBothTimes(inLogs, outLogs);

                console.log(`   ⏱️ NET Time (active work): ${timeCalc.netTime}`);
                console.log(`   🕐 GROSS Time (total presence): ${timeCalc.grossTime}`);
                console.log(`   ☕ Break Time: ${timeCalc.breakTime}`);
                console.log(`   📋 Sessions:`);
                timeCalc.sessions.forEach((s, i) => {
                    console.log(`      ${i + 1}. ${s.in} → ${s.out} = ${s.duration}`);
                });

                // Check edited hours
                const [editedEntry] = await pool.query(
                    `SELECT new_hours, reason FROM attendance_edited
                     WHERE employee_code = ? AND date = ?`,
                    [employee.employee_code, dateStr]
                );

                let finalNetTime = timeCalc.netTime;
                let isEdited = false;
                let editReason = null;

                if (editedEntry.length > 0) {
                    finalNetTime = editedEntry[0].new_hours.toString();
                    isEdited = true;
                    editReason = editedEntry[0].reason;
                    console.log(`   ✏️ EDITED: ${finalNetTime} (Original: ${timeCalc.netTime})`);
                }

                const allLoginTimes = inLogs.map(log => moment(log.log_time, 'HH:mm:ss').format('HH:mm'));
                const allLogoutTimes = outLogs.map(log => moment(log.log_time, 'HH:mm:ss').format('HH:mm'));

                await sendIndividualAttendanceReport({
                    employeeCode: employee.employee_code,
                    employeeName: employee.name,
                    email: employee.email,
                    department: employee.designation || 'N/A',
                    date: dateStr,
                    firstLogin: allLoginTimes[0] || 'N/A',
                    lastLogout: allLogoutTimes[allLogoutTimes.length - 1] || 'N/A',
                    netTime: finalNetTime,
                    grossTime: timeCalc.grossTime,
                    breakTime: timeCalc.breakTime,
                    isEdited: isEdited,
                    editReason: editReason,
                    totalLogins: inLogs.length,
                    totalLogouts: outLogs.length,
                    allLoginTimes: allLoginTimes,
                    allLogoutTimes: allLogoutTimes,
                    sessions: timeCalc.sessions
                });

                successCount++;
                console.log(`   ✅ Email sent to ${employee.email}`);
                await new Promise(resolve => setTimeout(resolve, 200));

            } catch (error) {
                failCount++;
                console.error(`   ❌ Failed: ${error.message}`);
            }
        }

        console.log(`\n${'='.repeat(70)}`);
        console.log(`📊 SUMMARY: ✅ ${successCount} | ❌ ${failCount} | ⚠️ ${noDataCount}`);
        console.log(`${'='.repeat(70)}\n`);

        const result = {
            success: true,
            message: 'Individual reports sent',
            report_date: dateStr,
            success_count: successCount,
            fail_count: failCount
        };

        if (res) res.json(result);
        return result;

    } catch (error) {
        console.error('❌ Error:', error);
        if (res) {
            res.status(500).json({
                success: false,
                message: 'Error sending reports',
                error: error.message
            });
        }
        throw error;
    }
};

export const sendDailyReport = async (req, res, daysAgo = 2) => {
    try {
        if (req?.user) {
            const role = req.user.role_name;
            if (!['hr', 'manager', 'superadmin'].includes(role)) {
                return res.status(403).json({
                    success: false,
                    message: 'No permission'
                });
            }
        }

        const reportDate = moment().subtract(daysAgo, 'days');
        const dateStr = reportDate.format('YYYY-MM-DD');

        const [employeeCodes] = await pool.query(
            `SELECT DISTINCT employee_code FROM attendance_logs WHERE log_date = ? ORDER BY employee_code`,
            [dateStr]
        );

        const reportData = [];

        for (const emp of employeeCodes) {
            const [logs] = await pool.query(
                `SELECT log_time, direction FROM attendance_logs
                 WHERE employee_code = ? AND log_date = ? ORDER BY id ASC`,
                [emp.employee_code, dateStr]
            );

            const inLogs = logs.filter(log => log.direction === 'in');
            const outLogs = logs.filter(log => log.direction === 'out');

            const timeCalc = calculateBothTimes(inLogs, outLogs);

            const [edited] = await pool.query(
                `SELECT new_hours FROM attendance_edited WHERE employee_code = ? AND date = ?`,
                [emp.employee_code, dateStr]
            );

            const finalNetTime = edited.length > 0 ? edited[0].new_hours.toString() : timeCalc.netTime;

            reportData.push({
                employee_code: emp.employee_code,
                date: dateStr,
                in_time: inLogs[0] ? moment(inLogs[0].log_time, 'HH:mm:ss').format('HH:mm') : '-',
                out_time: outLogs[outLogs.length - 1] ? moment(outLogs[outLogs.length - 1].log_time, 'HH:mm:ss').format('HH:mm') : '-',
                net_time: finalNetTime,
                gross_time: timeCalc.grossTime,
                is_edited: edited.length > 0
            });
        }

        const [users] = await pool.query(
            `SELECT u.email FROM users u
             INNER JOIN employees e ON u.id = e.user_id
             INNER JOIN roles r ON e.role_id = r.id
             WHERE r.role_name IN ('hr', 'manager', 'superadmin') 
             AND u.email IS NOT NULL AND u.email != ''`
        );

        const recipients = users.map(u => u.email);

        if (recipients.length === 0) {
            return res ? res.status(400).json({ success: false, message: 'No recipients' }) : null;
        }

        await sendAttendanceReport(reportData, recipients, dateStr);

        const result = {
            success: true,
            message: `HR report sent for ${reportDate.format('DD MMM YYYY')}`,
            report_date: dateStr,
            recipients_count: recipients.length,
            records_count: reportData.length
        };

        if (res) res.json(result);
        return result;
    } catch (error) {
        console.error('Error:', error);
        if (res) {
            res.status(500).json({ success: false, message: 'Error', error: error.message });
        }
        throw error;
    }
};
