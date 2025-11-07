import moment from 'moment';
import pool from '../config/db.js';
import { sendAttendanceReport, sendIndividualAttendanceReport } from '../utils/emailService.js';
import PDFDocument from 'pdfkit-table';
import fs from 'fs';
import path from 'path';


// ✅ Calculate BOTH gross and net time
// ✅ CORRECT: Remove consecutive duplicate IN or OUT punches, then pair properly
// ✅ FIXED: Add date parameter and validation
const calculateBothTimes = (inLogs, outLogs, logDate) => {
    const allLogs = [];
    
    // ✅ Parse with FULL date+time, not just time
    inLogs.forEach(log => {
        const timestamp = moment(`${logDate} ${log.log_time}`, 'YYYY-MM-DD HH:mm:ss');
        
        // ✅ Validate moment object
        if (!timestamp.isValid()) {
            return;
        }
        
        allLogs.push({
            time: log.log_time,
            direction: 'in',
            timestamp
        });
    });
    
    outLogs.forEach(log => {
        const timestamp = moment(`${logDate} ${log.log_time}`, 'YYYY-MM-DD HH:mm:ss');
        
        // ✅ Validate moment object
        if (!timestamp.isValid()) {
            return;
        }
        
    });
    
    // Sort by actual time
    allLogs.sort((a, b) => a.timestamp.diff(b.timestamp));
    
    // Remove consecutive duplicates
    const cleanedLogs = [];
    let lastDirection = null;
    
    for (const log of allLogs) {
        if (log.direction !== lastDirection) {
            cleanedLogs.push(log);
            lastDirection = log.direction;
        } else {
            console.log(`      ⚠️ Skipping duplicate ${log.direction.toUpperCase()} at ${log.timestamp.format('HH:mm')}`);
        }
    }
    
    const cleanedInLogs = cleanedLogs.filter(log => log.direction === 'in');
    const cleanedOutLogs = cleanedLogs.filter(log => log.direction === 'out');
    
    console.log(`      ✅ After cleaning: ${cleanedInLogs.length} IN, ${cleanedOutLogs.length} OUT`);
    
    // Calculate NET time
    let netMinutes = 0;
    const sessions = [];
    const minLength = Math.min(cleanedInLogs.length, cleanedOutLogs.length);

    for (let i = 0; i < minLength; i++) {
        const inTime = cleanedInLogs[i].timestamp;
        const outTime = cleanedOutLogs[i].timestamp;
        
        // ✅ Validate the diff result
        const diffSeconds = outTime.diff(inTime, 'seconds');
        
        if (isNaN(diffSeconds)) {
            console.error(`❌ NaN diff between ${inTime.format()} and ${outTime.format()}`);
            continue;
        }
        
        if (diffSeconds > 0) {
            const diffMinutes = Math.round(diffSeconds / 60);
            netMinutes += diffMinutes;
            
            sessions.push({
                in: inTime.format('HH:mm'),
                out: outTime.format('HH:mm'),
                duration: `${Math.floor(diffMinutes / 60)}:${(diffMinutes % 60).toString().padStart(2, '0')}`
            });
        }
    }
    
    // Calculate GROSS time
    let grossMinutes = 0;
    if (cleanedInLogs.length > 0 && cleanedOutLogs.length > 0) {
        const firstIn = cleanedInLogs[0].timestamp;
        const lastOut = cleanedOutLogs[cleanedOutLogs.length - 1].timestamp;
        
        // ✅ Validate both timestamps
        if (firstIn.isValid() && lastOut.isValid()) {
            grossMinutes = lastOut.diff(firstIn, 'minutes');
            
            // ✅ Double-check for NaN
            if (isNaN(grossMinutes) || grossMinutes < 0) {
                console.error(`❌ Invalid gross calculation: ${firstIn.format()} to ${lastOut.format()}`);
                grossMinutes = 0;
            }
        } else {
            console.error(`❌ Invalid timestamps for gross calculation`);
        }
    }
    
    const formatTime = (minutes) => {
        // ✅ Handle NaN, negative, or invalid values
        if (isNaN(minutes) || minutes < 0) {
            return '0:00';
        }
        
        const hours = Math.floor(minutes / 60);
        const mins = minutes % 60;
        return `${hours}:${mins.toString().padStart(2, '0')}`;
    };
    
    return {
        netTime: formatTime(netMinutes),
        grossTime: formatTime(grossMinutes),
        breakTime: formatTime(grossMinutes - netMinutes),
        netMinutes,
        grossMinutes,
        sessions,
        cleanedInCount: cleanedInLogs.length,
        cleanedOutCount: cleanedOutLogs.length
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
const timeCalc = calculateBothTimes(inLogs, outLogs, dateStr); 

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

const timeCalc = calculateBothTimes(inLogs, outLogs, dateStr); 
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





// ✅ Send weekly attendance report as PDF to HR
export const sendWeeklyPDFReport = async (req, res, weeksAgo = 0) => {
    try {
        // Calculate week range
        const endDate = moment().subtract(weeksAgo, 'weeks').endOf('week');
        const startDate = moment(endDate).startOf('week');
        const startDateStr = startDate.format('YYYY-MM-DD');
        const endDateStr = endDate.format('YYYY-MM-DD');

        console.log(`\n${'='.repeat(70)}`);
        console.log(`📅 Generating weekly report: ${startDate.format('DD MMM')} - ${endDate.format('DD MMM YYYY')}`);
        console.log(`${'='.repeat(70)}\n`);

        // Fetch all employees
        const [employees] = await pool.query(
            `SELECT 
                u.employee_id as employee_code,
                u.email,
                u.name,
                e.designation,
                e.id as emp_id
             FROM users u
             INNER JOIN employees e ON u.id = e.user_id
             WHERE e.is_active = TRUE
             ORDER BY u.name ASC`
        );

        if (employees.length === 0) {
            return res ? res.status(404).json({ success: false, message: 'No employees found' }) : null;
        }

        console.log(`👥 Processing ${employees.length} employees\n`);

        // Collect attendance data for all employees
        const reportData = [];
        
        for (const employee of employees) {
            console.log(`Processing: ${employee.name} (${employee.employee_code})`);
            
            // Get attendance logs for the week
            const [logs] = await pool.query(
                `SELECT log_date, log_time, direction, id
                 FROM attendance_logs
                 WHERE employee_code = ?
                 AND log_date BETWEEN ? AND ?
                 ORDER BY log_date, id ASC`,
                [employee.employee_code, startDateStr, endDateStr]
            );

            // Process each day
            const weekDays = [];
            for (let d = moment(startDate); d.isSameOrBefore(endDate); d.add(1, 'days')) {
                const dateStr = d.format('YYYY-MM-DD');
                const dayName = d.format('ddd');
                
                const dayLogs = logs.filter(log => log.log_date === dateStr);
                const inLogs = dayLogs.filter(log => log.direction === 'in');
                const outLogs = dayLogs.filter(log => log.direction === 'out');

                let netTime = '0:00';
                let grossTime = '0:00';
                
                if (inLogs.length > 0 && outLogs.length > 0) {
const timeCalc = calculateBothTimes(inLogs, outLogs, dateStr);                     netTime = timeCalc.netTime;
                    grossTime = timeCalc.grossTime;

                    // Check for edited hours
                    const [edited] = await pool.query(
                        `SELECT new_hours FROM attendance_edited 
                         WHERE employee_code = ? AND date = ?`,
                        [employee.employee_code, dateStr]
                    );
                    
                    if (edited.length > 0) {
                        netTime = edited[0].new_hours.toString() + ' ✏️';
                    }
                }

                weekDays.push({
                    date: d.format('DD MMM'),
                    day: dayName,
                    firstIn: inLogs[0] ? moment(inLogs[0].log_time, 'HH:mm:ss').format('HH:mm') : '-',
                    lastOut: outLogs[outLogs.length - 1] ? moment(outLogs[outLogs.length - 1].log_time, 'HH:mm:ss').format('HH:mm') : '-',
                    netTime,
                    grossTime
                });
            }

            // Calculate weekly totals
            let totalNetMinutes = 0;
            let totalGrossMinutes = 0;
            
            weekDays.forEach(day => {
                if (day.netTime !== '0:00') {
                    const [h, m] = day.netTime.replace(' ✏️', '').split(':');
                    totalNetMinutes += parseInt(h) * 60 + parseInt(m);
                }
                if (day.grossTime !== '0:00') {
                    const [h, m] = day.grossTime.split(':');
                    totalGrossMinutes += parseInt(h) * 60 + parseInt(m);
                }
            });

            const formatTime = (minutes) => {
                const hours = Math.floor(minutes / 60);
                const mins = minutes % 60;
                return `${hours}:${mins.toString().padStart(2, '0')}`;
            };

            reportData.push({
                employeeCode: employee.employee_code,
                employeeName: employee.name,
                designation: employee.designation || 'N/A',
                email: employee.email,
                weekDays,
                totalNet: formatTime(totalNetMinutes),
                totalGross: formatTime(totalGrossMinutes)
            });
        }

        // Generate PDF
        const pdfPath = await generateWeeklyPDF(reportData, startDateStr, endDateStr);

        // Get HR recipients
        const [users] = await pool.query(
            `SELECT u.email FROM users u
             INNER JOIN employees e ON u.id = e.user_id
             INNER JOIN roles r ON e.role_id = r.id
             WHERE r.role_name IN ('hr', 'manager', 'superadmin') 
             AND u.email IS NOT NULL AND u.email != ''`
        );

        const recipients = users.map(u => u.email);

        if (recipients.length === 0) {
            console.log('⚠️ No HR recipients found');
            return res ? res.status(400).json({ success: false, message: 'No HR recipients' }) : null;
        }

        // Send email with PDF attachment
        await sendWeeklyPDFEmail(recipients, pdfPath, startDateStr, endDateStr);

        // Clean up PDF file after sending
        fs.unlinkSync(pdfPath);

        console.log(`\n✅ Weekly PDF report sent successfully to ${recipients.length} recipients\n`);

        const result = {
            success: true,
            message: `Weekly report sent for ${startDate.format('DD MMM')} - ${endDate.format('DD MMM YYYY')}`,
            period: { start: startDateStr, end: endDateStr },
            recipients_count: recipients.length,
            employees_count: reportData.length
        };

        if (res) res.json(result);
        return result;

    } catch (error) {
        console.error('❌ Error generating weekly report:', error);
        if (res) {
            res.status(500).json({ 
                success: false, 
                message: 'Error generating weekly report', 
                error: error.message 
            });
        }
        throw error;
    }
};

// ✅ Generate PDF using pdfkit-table
const generateWeeklyPDF = async (reportData, startDate, endDate) => {
    return new Promise((resolve, reject) => {
        try {
            const fileName = `weekly-attendance-${startDate}-to-${endDate}.pdf`;
            const filePath = path.join(process.cwd(), 'temp', fileName);

            // Create temp directory if it doesn't exist
            const tempDir = path.join(process.cwd(), 'temp');
            if (!fs.existsSync(tempDir)) {
                fs.mkdirSync(tempDir, { recursive: true });
            }

            // Initialize PDF document
            const doc = new PDFDocument({ 
                margin: 30, 
                size: 'A4',
                layout: 'landscape' // Better for weekly data
            });

            doc.pipe(fs.createWriteStream(filePath));

            // Title
            doc.fontSize(18)
               .font('Helvetica-Bold')
               .text('Weekly Attendance Report', { align: 'center' });
            
            doc.fontSize(12)
               .font('Helvetica')
               .text(`Period: ${moment(startDate).format('DD MMM YYYY')} - ${moment(endDate).format('DD MMM YYYY')}`, 
                     { align: 'center' })
               .moveDown();

            // Create table data for each employee
            (async function createTables() {
                for (let i = 0; i < reportData.length; i++) {
                    const emp = reportData[i];

                    // Employee header
                    doc.fontSize(11)
                       .font('Helvetica-Bold')
                       .text(`${emp.employeeName} (${emp.employeeCode}) - ${emp.designation}`, {
                           continued: false
                       })
                       .moveDown(0.5);

                    // Prepare table rows
                    const tableRows = emp.weekDays.map(day => [
                        day.date,
                        day.day,
                        day.firstIn,
                        day.lastOut,
                        day.netTime,
                        day.grossTime
                    ]);

                    // Add total row
                    tableRows.push([
                        'TOTAL',
                        '',
                        '',
                        '',
                        emp.totalNet,
                        emp.totalGross
                    ]);

                    const table = {
                        headers: [
                            { label: 'Date', property: 'date', width: 70 },
                            { label: 'Day', property: 'day', width: 50 },
                            { label: 'First In', property: 'firstIn', width: 70 },
                            { label: 'Last Out', property: 'lastOut', width: 70 },
                            { label: 'Net Hours', property: 'netTime', width: 80 },
                            { label: 'Gross Hours', property: 'grossTime', width: 80 }
                        ],
                        rows: tableRows
                    };

                    await doc.table(table, {
                        width: 520,
                        prepareHeader: () => doc.font('Helvetica-Bold').fontSize(9),
                        prepareRow: (row, indexColumn, indexRow, rectRow, rectCell) => {
                            doc.font('Helvetica').fontSize(8);
                            // Highlight total row
                            if (indexRow === tableRows.length - 1) {
                                doc.font('Helvetica-Bold').fontSize(9);
                                doc.addBackground(rectRow, '#E8F4F8', 0.5);
                            }
                            // Alternate row colors
                            if (indexRow < tableRows.length - 1 && indexRow % 2 === 0) {
                                doc.addBackground(rectRow, '#F5F5F5', 0.3);
                            }
                        }
                    });

                    doc.moveDown(1);

                    // Add page break if needed (except for last employee)
                    if (i < reportData.length - 1 && doc.y > 500) {
                        doc.addPage();
                    }
                }

                // Footer
                doc.fontSize(8)
                   .font('Helvetica')
                   .text(`Generated on: ${moment().format('DD MMM YYYY, HH:mm')}`, {
                       align: 'center'
                   });

                doc.end();

                doc.on('finish', () => {
                    console.log(`✅ PDF generated: ${fileName}`);
                    resolve(filePath);
                });

                doc.on('error', (err) => {
                    reject(err);
                });
            })();

        } catch (error) {
            reject(error);
        }
    });
};
