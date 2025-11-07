import pool from '../config/db.js';
import biometricPool from '../config/biometricDb.js';
import moment from 'moment';




export const getFullEmployeeAttendanceDetails = async (req, res) => {
    try {
        const { start_date, end_date, employee_code } = req.query;
        const role = req.user.role_name;

        // Permission check
        if (!['hr', 'manager', 'superadmin'].includes(role)) {
            return res.status(403).json({
                success: false,
                message: 'You do not have permission to view this data'
            });
        }

        // Date range setup
        const startDate = start_date || moment().startOf('month').format('YYYY-MM-DD');
        const endDate = end_date || moment().endOf('month').format('YYYY-MM-DD');

        // Step 1: Get attendance logs
        let attendanceQuery = `
            SELECT employee_code, id, log_date, log_time, direction, log_date_time
            FROM attendance_logs 
            WHERE log_date BETWEEN ? AND ?
        `;
        let attendanceParams = [startDate, endDate];

        if (employee_code) {
            attendanceQuery += ` AND employee_code = ?`;
            attendanceParams.push(employee_code);
        }

        attendanceQuery += ` ORDER BY employee_code, id ASC`;
        const [logs] = await pool.query(attendanceQuery, attendanceParams);

        // Step 2: Process attendance logs
        const groupedByEmployee = {};
        logs.forEach(log => {
            if (!groupedByEmployee[log.employee_code]) {
                groupedByEmployee[log.employee_code] = [];
            }
            groupedByEmployee[log.employee_code].push(log);
        });

        let allProcessedData = [];
        for (const empCode in groupedByEmployee) {
            const empLogs = groupedByEmployee[empCode];
            const processedLogs = processLogsSimple(empLogs);
            allProcessedData = allProcessedData.concat(
                processedLogs.map(log => ({
                    ...log,
                    employee_code: empCode
                }))
            );
        }

        // Step 3: Get employee codes for lookup
        const employeeCodes = Object.keys(groupedByEmployee);

        // Step 4: Fetch combined employee + user details
        // Match attendance_logs.employee_code with users.employee_id
        let employeeUserQuery = `
            SELECT 
                employees.id AS employee_row_id,
                employees.user_id,
                employees.mobile_number,
                employees.role_id,
                employees.department_id,
                employees.date_of_birth,
                employees.date_of_joining,
                employees.designation,
                employees.is_active,
                employees.created_at AS employee_created_at,
                employees.updated_at AS employee_updated_at,
                users.id AS user_id,
                users.employee_id AS employee_code,
                users.name AS employee_name,
                users.email,
                users.created_at AS user_created_at,
                users.updated_at AS user_updated_at
            FROM users
            JOIN employees ON users.id = employees.user_id
            LEFT JOIN departments ON employees.department_id = departments.id
        `;

        if (employeeCodes.length > 0) {
            // Match using users.employee_id
            employeeUserQuery += ` WHERE users.employee_id IN (?)`;
        }

        const [employeeUserData] = await pool.query(
            employeeUserQuery, 
            employeeCodes.length > 0 ? [employeeCodes] : []
        );

        // Step 5: Create lookup map by employee_code (users.employee_id)
        const employeeMap = {};
        employeeUserData.forEach(emp => {
            employeeMap[emp.employee_code] = emp;
        });

        // Step 6: Enrich attendance data with employee+user details
        const enrichedData = allProcessedData.map(record => {
            const empDetails = employeeMap[record.employee_code] || {};
            return {
                ...record,
                employee_row_id: empDetails.employee_row_id || null,
                user_id: empDetails.user_id || null,
                employee_name: empDetails.employee_name || 'Unknown',
                email: empDetails.email || 'N/A',
                mobile_number: empDetails.mobile_number || 'N/A',
                designation: empDetails.designation || 'N/A',
                department_name: empDetails.department_name || 'N/A',
                date_of_joining: empDetails.date_of_joining || null,
                is_active: empDetails.is_active || null,
                role_id: empDetails.role_id || null
            };
        });

        res.json({
            success: true,
            data: enrichedData,
            count: enrichedData.length
        });
    } catch (error) {
        console.error('Full attendance details error:', error);
        res.status(500).json({
            success: false,
                message: 'Error fetching full attendance details',
            error: error.message
        });
    }
};



// Get attendance for a specific employee
export const getMyAttendance = async (req, res) => {
    try {
        const { start_date, end_date } = req.query;
        const employeeCode = req.user.employee_id;

        const startDate = start_date || moment().startOf('month').format('YYYY-MM-DD');
        const endDate = end_date || moment().endOf('month').format('YYYY-MM-DD');

        // Query from biometric DB
        const [logs] = await biometricPool.query(
            `SELECT id, log_date, log_time, direction, log_date_time
             FROM attendance_logs 
             WHERE employee_code = ? 
             AND log_date BETWEEN ? AND ?
             ORDER BY id ASC`,
            [employeeCode, startDate, endDate]
        );

        const processedData = processLogsSimple(logs);

        // Include ALL data from processedData (including pairs)
        const simplifiedData = processedData.map(log => ({
            employee_code: employeeCode,
            date: log.date,
            total_hours: log.total_hours,
            first_in: log.first_in,
            last_out: log.last_out,
            pairs: log.pairs,  // Include pairs for punch details
            punch_count: log.punch_count
        }));

        res.json({
            success: true,
            data: simplifiedData,
            count: simplifiedData.length
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









export const gettotalhoursforcalendar = async (req, res) => {
    try {
        const { start_date, end_date } = req.query;
        const employeeCode = req.user.employee_id;

        const startDate = start_date || moment().startOf('month').format('YYYY-MM-DD');
        const endDate = end_date || moment().endOf('month').format('YYYY-MM-DD');

        // Query from biometric DB
        const [logs] = await biometricPool.query(
            `SELECT id, log_date, log_time, direction, log_date_time
             FROM attendance_logs 
             WHERE employee_code = ? 
             AND log_date BETWEEN ? AND ?
             ORDER BY id ASC`,
            [employeeCode, startDate, endDate]
        );

        const processedData = processLogsSimple(logs);

        // Include ALL data from processedData (including pairs)
        const simplifiedData = processedData.map(log => ({
            employee_code: employeeCode,
            date: log.date,
            total_hours: log.total_hours,
            first_in: log.first_in,
            last_out: log.last_out,
            pairs: log.pairs,  // Include pairs for punch details
            punch_count: log.punch_count
        }));

        res.json({
            success: true,
            data: simplifiedData,
            count: simplifiedData.length
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




export const updateAttendanceHours = async (req, res) => {
    try {
        const { employee_code, date, new_hours, reason, is_od } = req.body;  // Add is_od flag
        const role = req.user.role_name;
        const modified_by = req.user.id;

        // Check permission
        if (!['hr', 'manager', 'superadmin'].includes(role)) {
            return res.status(403).json({
                success: false,
                message: 'You do not have permission to edit attendance'
            });
        }

        // Validation
        if (!employee_code || !date || new_hours === undefined) {
            return res.status(400).json({
                success: false,
                message: 'Employee code, date, and new hours are required'
            });
        }

        if (new_hours < 0 || new_hours > 24) {
            return res.status(400).json({
                success: false,
                message: 'Hours must be between 0 and 24'
            });
        }

        // Get current attendance record
        const [currentRecords] = await pool.query(
            `SELECT employee_code, log_date, 
                    SUM(CASE WHEN direction = 0 THEN 1 ELSE 0 END) as total_hours
             FROM attendance_logs 
             WHERE employee_code = ? AND log_date = ?
             GROUP BY employee_code, log_date`,
            [employee_code, date]
        );

        if (currentRecords.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Attendance record not found'
            });
        }

        const old_hours = currentRecords[0].total_hours;
        
        // Calculate final hours based on whether it's OD or manual edit
        let final_hours;
        if (is_od) {
            // For OD, ADD the hours to existing hours
            final_hours = parseFloat(old_hours) + parseFloat(new_hours);
        } else {
            // For manual edit, REPLACE with new hours
            final_hours = new_hours;
        }

        // Check if record already exists in edited table
        const [existingEdit] = await pool.query(
            `SELECT * FROM attendance_edited 
             WHERE employee_code = ? AND date = ?`,
            [employee_code, date]
        );

        if (existingEdit.length > 0) {
            // Update existing edited record
            await pool.query(
                `UPDATE attendance_edited 
                 SET old_hours = ?, 
                     new_hours = ?, 
                     reason = ?,
                     modified_by = ?,
                     modified_at = NOW()
                 WHERE employee_code = ? AND date = ?`,
                [old_hours, final_hours, reason || null, modified_by, employee_code, date]
            );
        } else {
            // Insert new edited record
            await pool.query(
                `INSERT INTO attendance_edited 
                 (employee_code, date, old_hours, new_hours, reason, modified_by, modified_at)
                 VALUES (?, ?, ?, ?, ?, ?, NOW())`,
                [employee_code, date, old_hours, final_hours, reason || null, modified_by]
            );
        }

        res.json({
            success: true,
            message: is_od ? 'Over Duty hours added successfully' : 'Attendance hours updated successfully',
            data: {
                employee_code,
                date,
                old_hours,
                new_hours: final_hours,
                od_hours_added: is_od ? new_hours : null
            }
        });
    } catch (error) {
        console.error('Update attendance error:', error);
        res.status(500).json({
            success: false,
            message: 'Error updating attendance',
            error: error.message
        });
    }
};


// Get all attendance
//controller with alll punch count

// export const getAllAttendance = async (req, res) => {
//     try {
//         const { start_date, end_date, employee_code } = req.query;
//         const role = req.user.role_name;

//         if (!['hr', 'manager', 'superadmin'].includes(role)) {
//             return res.status(403).json({
//                 success: false,
//                 message: 'You do not have permission to view all attendance'
//             });
//         }

//         const startDate = start_date || moment().startOf('month').format('YYYY-MM-DD');
//         const endDate = end_date || moment().endOf('month').format('YYYY-MM-DD');

//         let query = `SELECT employee_code, id, log_date, log_time, direction, log_date_time
//                      FROM attendance_logs 
//                      WHERE log_date BETWEEN ? AND ?`;
//         let params = [startDate, endDate];

//         if (employee_code) {
//             query += ` AND employee_code = ?`;
//             params.push(employee_code);
//         }

//         query += ` ORDER BY employee_code, id ASC`;

//         const [logs] = await pool.query(query, params);

//         // Group by employee
//         const groupedByEmployee = {};
//         logs.forEach(log => {
//             if (!groupedByEmployee[log.employee_code]) {
//                 groupedByEmployee[log.employee_code] = [];
//             }
//             groupedByEmployee[log.employee_code].push(log);
//         });

//         // Process each employee
//         let allProcessedData = [];
//         for (const empCode in groupedByEmployee) {
//             const empLogs = groupedByEmployee[empCode];
//             const processedLogs = processLogsSimple(empLogs);
//             allProcessedData = allProcessedData.concat(
//                 processedLogs.map(log => ({
//                     ...log,
//                     employee_code: empCode
//                 }))
//             );
//         }

//         // Enrich with employee details
//         const employeeCodes = Object.keys(groupedByEmployee);
//         const employeeDetails = await getEmployeeDetails(employeeCodes);

//         const enrichedData = allProcessedData.map(record => ({
//             ...record,
//             employee_name: employeeDetails[record.employee_code]?.name || 'Unknown',
//             designation: employeeDetails[record.employee_code]?.designation || 'N/A',
//             department: employeeDetails[record.employee_code]?.department_name || 'N/A'
//         }));

//         res.json({
//             success: true,
//             data: enrichedData,
//             count: enrichedData.length
//         });
//     } catch (error) {
//         console.error('Attendance error:', error);
//         res.status(500).json({
//             success: false,
//             message: 'Error fetching attendance',
//             error: error.message
//         });
//     }
// };


//without punch 
export const getAllAttendance = async (req, res) => {
    try {
        const { start_date, end_date, employee_code } = req.query;
        const role = req.user.role_name;

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

        query += ` ORDER BY employee_code, id ASC`;

        const [logs] = await pool.query(query, params);

        // Get edited records
        let editQuery = `SELECT employee_code, date, new_hours, reason, modified_by, modified_at
                         FROM attendance_edited 
                         WHERE date BETWEEN ? AND ?`;
        let editParams = [startDate, endDate];

        if (employee_code) {
            editQuery += ` AND employee_code = ?`;
            editParams.push(employee_code);
        }

        const [editedRecords] = await pool.query(editQuery, editParams);

        // Create a map for edited records
        const editedMap = {};
        editedRecords.forEach(record => {
            const key = `${record.employee_code}_${moment(record.date).format('YYYY-MM-DD')}`;
            editedMap[key] = record;
        });

        // Group by employee
        const groupedByEmployee = {};
        logs.forEach(log => {
            if (!groupedByEmployee[log.employee_code]) {
                groupedByEmployee[log.employee_code] = [];
            }
            groupedByEmployee[log.employee_code].push(log);
        });

        // Process each employee
        let allProcessedData = [];
        for (const empCode in groupedByEmployee) {
            const empLogs = groupedByEmployee[empCode];
            const processedLogs = processLogsSimple(empLogs);
            
            allProcessedData = allProcessedData.concat(
                processedLogs.map(log => {
                    const key = `${empCode}_${log.date}`;
                    const edited = editedMap[key];
                    
                    return {
                        employee_code: empCode,
                        date: log.date,
                        total_hours: edited ? edited.new_hours : log.total_hours,
                        original_hours: edited ? log.total_hours : null,
                        is_edited: !!edited,
                        edit_reason: edited ? edited.reason : null,
                        modified_at: edited ? edited.modified_at : null
                    };
                })
            );
        }

        res.json({
            success: true,
            data: allProcessedData,
            count: allProcessedData.length
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


// Get attendance summary - CORRECTED to use pool only
export const getAttendanceSummary = async (req, res) => {
    try {
        const { date } = req.query;
        const targetDate = date || moment().format('YYYY-MM-DD');
        const role = req.user.role_name;

        if (!['hr', 'manager', 'superadmin'].includes(role)) {
            return res.status(403).json({
                success: false,
                message: 'You do not have permission'
            });
        }

        // Query main DB for total employees
        const [[totalEmployees]] = await pool.query(
            'SELECT COUNT(*) as total FROM employees WHERE is_active = TRUE'
        );

        // Query BIOMETRIC DB for attendance data
        const [
            [presentEmployees],
            [lateArrivals]
        ] = await Promise.all([
            pool.query(
                `SELECT COUNT(DISTINCT employee_code) as present 
                 FROM attendance_logs 
                 WHERE log_date = ?`,
                [targetDate]
            ),
            biometricPool.query(
                `SELECT COUNT(DISTINCT employee_code) as late 
                 FROM attendance_logs 
                 WHERE log_date = ? 
                 AND direction = 'in' 
                 AND TIME(log_time) > '09:30:00'`,
                [targetDate]
            )
        ]);

        const total = totalEmployees.total;
        const present = presentEmployees[0].present;
        const absent = total - present;
        const late = lateArrivals[0].late;

        res.json({
            success: true,
            data: {
                total_employees: total,
                present: present,
                absent: absent,
                late: late,
                on_time: present - late,
                date: targetDate
            }
        });
    } catch (error) {
        console.error('Summary error:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching summary',
            error: error.message
        });
    }
};


// Process logs by date - Handle duplicate IN/OUT properly
function processLogsSimple(logs) {
    const groupedByDate = {};

    logs.forEach(log => {
        const date = moment(log.log_date).format('YYYY-MM-DD');
        
        if (!groupedByDate[date]) {
            groupedByDate[date] = {
                date: date,
                allPunches: []
            };
        }

        groupedByDate[date].allPunches.push({
            id: log.id,
            time: log.log_time,
            direction: log.direction,
            timestamp: log.log_date_time
        });
    });

    const result = [];
    for (const date in groupedByDate) {
        const dayData = groupedByDate[date];
        
        // Sort by ID to ensure chronological order
        dayData.allPunches.sort((a, b) => a.id - b.id);

        // Filter consecutive duplicates
        const cleanedPunches = [];
        let lastDirection = null;

        dayData.allPunches.forEach(punch => {
            if (punch.direction === lastDirection) {
                return; // Skip duplicate
            }
            cleanedPunches.push(punch);
            lastDirection = punch.direction;
        });

        // Create pairs by matching each IN with the NEXT OUT chronologically
        const pairs = [];
        let totalMinutes = 0;
        let firstIn = null;
        let lastOut = null;

        for (let i = 0; i < cleanedPunches.length; i++) {
            const currentPunch = cleanedPunches[i];
            
            // Track first IN
            if (currentPunch.direction === 'in' && !firstIn) {
                firstIn = currentPunch.time;
            }
            
            // Track last OUT
            if (currentPunch.direction === 'out') {
                lastOut = currentPunch.time;
            }

            // If current punch is IN, find the next OUT
            if (currentPunch.direction === 'in') {
                let matchedOut = null;
                
                // Search for next OUT punch after this IN
                for (let j = i + 1; j < cleanedPunches.length; j++) {
                    if (cleanedPunches[j].direction === 'out') {
                        matchedOut = cleanedPunches[j];
                        break;
                    }
                }

                const duration = calculateSimpleDuration(date, currentPunch.time, matchedOut?.time);
                
                pairs.push({
                    in: currentPunch.time,
                    out: matchedOut ? matchedOut.time : null,
                    duration: duration
                });

                if (duration && duration > 0) {
                    totalMinutes += duration;
                }
            }
            // If it's an OUT without preceding IN, add it as orphaned OUT
            else if (currentPunch.direction === 'out') {
                // Check if this OUT was already paired
                const alreadyPaired = pairs.some(pair => pair.out === currentPunch.time);
                
                if (!alreadyPaired) {
                    pairs.push({
                        in: null,
                        out: currentPunch.time,
                        duration: null
                    });
                }
            }
        }

        result.push({
            date: date,
            first_in: firstIn,
            last_out: lastOut,
            pairs: pairs,
            total_hours: (totalMinutes / 60).toFixed(2),
            punch_count: cleanedPunches.length,
            raw_punch_count: dayData.allPunches.length
        });
    }

    result.sort((a, b) => new Date(b.date) - new Date(a.date));

    return result;
}

// Duration calculation remains the same
function calculateSimpleDuration(date, inTime, outTime) {
    if (!inTime || !outTime) return null;

    try {
        const inDateTime = moment(`${date} ${inTime}`, 'YYYY-MM-DD HH:mm:ss');
        const outDateTime = moment(`${date} ${outTime}`, 'YYYY-MM-DD HH:mm:ss');

        const duration = outDateTime.diff(inDateTime, 'minutes');

        return duration > 0 ? duration : null;
    } catch (error) {
        console.error('Duration calculation error:', error);
        return null;
    }
}


// Helper: Get employee details
async function getEmployeeDetails(employeeCodes) {
    if (employeeCodes.length === 0) return {};

    const placeholders = employeeCodes.map(() => '?').join(',');
    const [employees] = await pool.query(
        `SELECT u.employee_id, u.name, e.designation, d.department_name
         FROM users u
         JOIN employees e ON u.id = e.user_id
         LEFT JOIN departments d ON e.department_id = d.id
         WHERE u.employee_id IN (${placeholders})`,
        employeeCodes
    );

    const employeeMap = {};
    employees.forEach(emp => {
        employeeMap[emp.employee_id] = emp;
    });

    return employeeMap;
}




import PDFDocument from 'pdfkit-table';
import fs from 'fs';
import path from 'path';

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
                    const timeCalc = calculateBothTimes(inLogs, outLogs);
                    netTime = timeCalc.netTime;
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









// import pool from '../config/db.js';
// import moment from 'moment';

// // Get attendance for a specific employee
// export const getMyAttendance = async (req, res) => {
//     try {
//         const { start_date, end_date } = req.query;
//         const employeeCode = req.user.employee_id;

//         const startDate = start_date || moment().startOf('month').format('YYYY-MM-DD');
//         const endDate = end_date || moment().endOf('month').format('YYYY-MM-DD');

//         // Query from MAIN DB attendance_logs table
//         const [logs] = await pool.query(
//             `SELECT id, log_date, log_time, direction, log_date_time
//              FROM attendance_logs 
//              WHERE employee_code = ? 
//              AND log_date BETWEEN ? AND ?
//              ORDER BY id ASC`,
//             [employeeCode, startDate, endDate]
//         );

//         const processedData = processLogsSimple(logs);

//         res.json({
//             success: true,
//             data: processedData,
//             employee_code: employeeCode
//         });
//     } catch (error) {
//         console.error('Attendance error:', error);
//         res.status(500).json({
//             success: false,
//             message: 'Error fetching attendance',
//             error: error.message
//         });
//     }
// };

// // Get all attendance
// export const getAllAttendance = async (req, res) => {
//     try {
//         const { start_date, end_date, employee_code } = req.query;
//         const role = req.user.role_name;

//         if (!['hr', 'manager', 'superadmin'].includes(role)) {
//             return res.status(403).json({
//                 success: false,
//                 message: 'You do not have permission to view all attendance'
//             });
//         }

//         const startDate = start_date || moment().startOf('month').format('YYYY-MM-DD');
//         const endDate = end_date || moment().endOf('month').format('YYYY-MM-DD');

//         let query = `SELECT employee_code, id, log_date, log_time, direction, log_date_time
//                      FROM attendance_logs 
//                      WHERE log_date BETWEEN ? AND ?`;
//         let params = [startDate, endDate];

//         if (employee_code) {
//             query += ` AND employee_code = ?`;
//             params.push(employee_code);
//         }

//         query += ` ORDER BY employee_code, id ASC`;

//         // Query from MAIN DB
//         const [logs] = await pool.query(query, params);

//         const groupedByEmployee = {};
//         logs.forEach(log => {
//             if (!groupedByEmployee[log.employee_code]) {
//                 groupedByEmployee[log.employee_code] = [];
//             }
//             groupedByEmployee[log.employee_code].push(log);
//         });

//         let allProcessedData = [];
//         for (const empCode in groupedByEmployee) {
//             const empLogs = groupedByEmployee[empCode];
//             const processedLogs = processLogsSimple(empLogs);
//             allProcessedData = allProcessedData.concat(
//                 processedLogs.map(log => ({
//                     ...log,
//                     employee_code: empCode
//                 }))
//             );
//         }

//         const employeeCodes = Object.keys(groupedByEmployee);
//         const employeeDetails = await getEmployeeDetails(employeeCodes);

//         const enrichedData = allProcessedData.map(record => ({
//             ...record,
//             employee_name: employeeDetails[record.employee_code]?.name || 'Unknown',
//             designation: employeeDetails[record.employee_code]?.designation || 'N/A',
//             department: employeeDetails[record.employee_code]?.department_name || 'N/A'
//         }));

//         res.json({
//             success: true,
//             data: enrichedData,
//             count: enrichedData.length
//         });
//     } catch (error) {
//         console.error('Attendance error:', error);
//         res.status(500).json({
//             success: false,
//             message: 'Error fetching attendance',
//             error: error.message
//         });
//     }
// };

// // Get attendance summary
// export const getAttendanceSummary = async (req, res) => {
//     try {
//         const { date } = req.query;
//         const targetDate = date || moment().format('YYYY-MM-DD');
//         const role = req.user.role_name;

//         if (!['hr', 'manager', 'superadmin'].includes(role)) {
//             return res.status(403).json({
//                 success: false,
//                 message: 'You do not have permission'
//             });
//         }

//         // Query from MAIN DB
//         const [
//             [totalEmployees],
//             [presentEmployees],
//             [lateArrivals]
//         ] = await Promise.all([
//             pool.query('SELECT COUNT(*) as total FROM employees WHERE is_active = TRUE'),
//             pool.query(
//                 `SELECT COUNT(DISTINCT employee_code) as present 
//                  FROM attendance_logs 
//                  WHERE log_date = ?`,
//                 [targetDate]
//             ),
//             pool.query(
//                 `SELECT COUNT(DISTINCT employee_code) as late 
//                  FROM attendance_logs 
//                  WHERE log_date = ? 
//                  AND direction = 'in' 
//                  AND TIME(log_time) > '09:30:00'`,
//                 [targetDate]
//             )
//         ]);

//         const total = totalEmployees[0].total;
//         const present = presentEmployees[0].present;
//         const absent = total - present;
//         const late = lateArrivals[0].late;

//         res.json({
//             success: true,
//             data: {
//                 total_employees: total,
//                 present: present,
//                 absent: absent,
//                 late: late,
//                 on_time: present - late,
//                 date: targetDate
//             }
//         });
//     } catch (error) {
//         console.error('Summary error:', error);
//         res.status(500).json({
//             success: false,
//             message: 'Error fetching summary',
//             error: error.message
//         });
//     }
// };

// // DEBUG: View raw attendance data
// export const debugAttendanceData = async (req, res) => {
//     try {
//         const { employee_code, date, limit = 50 } = req.query;

//         let query = 'SELECT * FROM attendance_logs WHERE 1=1';
//         let params = [];

//         if (employee_code) {
//             query += ' AND employee_code = ?';
//             params.push(employee_code);
//         }

//         if (date) {
//             query += ' AND log_date = ?';
//             params.push(date);
//         }

//         query += ' ORDER BY id ASC LIMIT ?';
//         params.push(parseInt(limit));

//         // Query from MAIN DB
//         const [logs] = await pool.query(query, params);

//         res.json({
//             success: true,
//             count: logs.length,
//             data: logs
//         });
//     } catch (error) {
//         res.status(500).json({
//             success: false,
//             error: error.message
//         });
//     }
// };

// // DEBUG: View processed attendance
// export const debugProcessedAttendance = async (req, res) => {
//     try {
//         const { employee_code, start_date, end_date } = req.query;

//         if (!employee_code) {
//             return res.status(400).json({
//                 success: false,
//                 message: 'employee_code is required'
//             });
//         }

//         const startDate = start_date || moment().startOf('month').format('YYYY-MM-DD');
//         const endDate = end_date || moment().endOf('month').format('YYYY-MM-DD');

//         // Query from MAIN DB
//         const [logs] = await pool.query(
//             `SELECT id, log_date, log_time, direction, log_date_time
//              FROM attendance_logs 
//              WHERE employee_code = ? 
//              AND log_date BETWEEN ? AND ?
//              ORDER BY id ASC`,
//             [employee_code, startDate, endDate]
//         );

//         const processed = processLogsSimple(logs);

//         res.json({
//             success: true,
//             employee_code: employee_code,
//             date_range: { start: startDate, end: endDate },
//             raw_data: {
//                 count: logs.length,
//                 logs: logs
//             },
//             processed_data: processed
//         });
//     } catch (error) {
//         res.status(500).json({
//             success: false,
//             error: error.message
//         });
//     }
// };

// // DEBUG: View ALL data from database
// export const debugViewAllData = async (req, res) => {
//     try {
//         const { page = 1, limit = 100, employee_code, date } = req.query;
//         const offset = (parseInt(page) - 1) * parseInt(limit);

//         let countQuery = 'SELECT COUNT(*) as total FROM attendance_logs';
//         let dataQuery = 'SELECT * FROM attendance_logs';
//         let whereConditions = [];
//         let params = [];
//         let countParams = [];

//         if (employee_code) {
//             whereConditions.push('employee_code = ?');
//             params.push(employee_code);
//             countParams.push(employee_code);
//         }

//         if (date) {
//             whereConditions.push('log_date = ?');
//             params.push(date);
//             countParams.push(date);
//         }

//         if (whereConditions.length > 0) {
//             const whereClause = ' WHERE ' + whereConditions.join(' AND ');
//             countQuery += whereClause;
//             dataQuery += whereClause;
//         }

//         // Query from MAIN DB
//         const [countResult] = await pool.query(countQuery, countParams);
//         const totalRecords = countResult[0].total;

//         dataQuery += ' ORDER BY id ASC LIMIT ? OFFSET ?';
//         params.push(parseInt(limit), offset);

//         const [data] = await pool.query(dataQuery, params);

//         const uniqueEmployees = [...new Set(data.map(d => d.employee_code))];
//         const dates = data.map(d => d.log_date);
//         const minDate = dates.length > 0 ? moment(Math.min(...dates.map(d => new Date(d)))).format('YYYY-MM-DD') : null;
//         const maxDate = dates.length > 0 ? moment(Math.max(...dates.map(d => new Date(d)))).format('YYYY-MM-DD') : null;

//         res.json({
//             success: true,
//             pagination: {
//                 current_page: parseInt(page),
//                 per_page: parseInt(limit),
//                 total_records: totalRecords,
//                 total_pages: Math.ceil(totalRecords / parseInt(limit))
//             },
//             summary: {
//                 total_records_in_db: totalRecords,
//                 unique_employees: uniqueEmployees.length,
//                 employee_codes: uniqueEmployees,
//                 date_range: {
//                     from: minDate,
//                     to: maxDate
//                 }
//             },
//             data: data
//         });
//     } catch (error) {
//         res.status(500).json({
//             success: false,
//             error: error.message
//         });
//     }
// };

// // DEBUG: Get database statistics
// export const debugDatabaseStats = async (req, res) => {
//     try {
//         // Query from MAIN DB
//         const [totalRecords] = await pool.query('SELECT COUNT(*) as total FROM attendance_logs');
//         const [uniqueEmployees] = await pool.query('SELECT COUNT(DISTINCT employee_code) as count FROM attendance_logs');
//         const [dateRange] = await pool.query(
//             'SELECT MIN(log_date) as first_date, MAX(log_date) as last_date FROM attendance_logs'
//         );
//         const [employeeStats] = await pool.query(
//             `SELECT employee_code, 
//                     COUNT(*) as total_punches,
//                     MIN(log_date) as first_punch_date,
//                     MAX(log_date) as last_punch_date
//              FROM attendance_logs 
//              GROUP BY employee_code 
//              ORDER BY total_punches DESC`
//         );
//         const [dateStats] = await pool.query(
//             `SELECT log_date, COUNT(*) as punch_count
//              FROM attendance_logs 
//              GROUP BY log_date 
//              ORDER BY log_date DESC 
//              LIMIT 30`
//         );
//         const [directionStats] = await pool.query(
//             `SELECT direction, COUNT(*) as count 
//              FROM attendance_logs 
//              GROUP BY direction`
//         );

//         res.json({
//             success: true,
//             database_stats: {
//                 total_records: totalRecords[0].total,
//                 unique_employees: uniqueEmployees[0].count,
//                 date_range: {
//                     first_date: dateRange[0].first_date,
//                     last_date: dateRange[0].last_date
//                 },
//                 direction_distribution: directionStats
//             },
//             employee_statistics: employeeStats,
//             recent_date_statistics: dateStats
//         });
//     } catch (error) {
//         res.status(500).json({
//             success: false,
//             error: error.message
//         });
//     }
// };

// // DEBUG: Load ALL data at once
// export const debugLoadAllData = async (req, res) => {
//     try {
//         const { employee_code, date } = req.query;

//         let query = 'SELECT * FROM attendance_logs';
//         let params = [];
//         let whereConditions = [];

//         if (employee_code) {
//             whereConditions.push('employee_code = ?');
//             params.push(employee_code);
//         }

//         if (date) {
//             whereConditions.push('log_date = ?');
//             params.push(date);
//         }

//         if (whereConditions.length > 0) {
//             query += ' WHERE ' + whereConditions.join(' AND ');
//         }

//         query += ' ORDER BY id ASC';

//         console.log('Loading all data...');
//         const startTime = Date.now();

//         // Query from MAIN DB
//         const [data] = await pool.query(query, params);

//         const endTime = Date.now();
//         const loadTime = ((endTime - startTime) / 1000).toFixed(2);

//         const uniqueEmployees = [...new Set(data.map(d => d.employee_code))];
//         const uniqueDates = [...new Set(data.map(d => moment(d.log_date).format('YYYY-MM-DD')))];
        
//         const inCount = data.filter(d => d.direction === 'in').length;
//         const outCount = data.filter(d => d.direction === 'out').length;

//         res.json({
//             success: true,
//             metadata: {
//                 total_records: data.length,
//                 unique_employees: uniqueEmployees.length,
//                 unique_dates: uniqueDates.length,
//                 direction_stats: {
//                     in: inCount,
//                     out: outCount
//                 },
//                 load_time_seconds: loadTime,
//                 filters_applied: {
//                     employee_code: employee_code || 'none',
//                     date: date || 'none'
//                 }
//             },
//             data: data
//         });
//     } catch (error) {
//         res.status(500).json({
//             success: false,
//             error: error.message,
//             message: 'Failed to load all data'
//         });
//     }
// };

// // Process logs by date - Handle duplicate IN/OUT
// function processLogsSimple(logs) {
//     const groupedByDate = {};

//     logs.forEach(log => {
//         const date = moment(log.log_date).format('YYYY-MM-DD');
        
//         if (!groupedByDate[date]) {
//             groupedByDate[date] = {
//                 date: date,
//                 allPunches: []
//             };
//         }

//         groupedByDate[date].allPunches.push({
//             id: log.id,
//             time: log.log_time,
//             direction: log.direction,
//             timestamp: log.log_date_time
//         });
//     });

//     const result = [];
//     for (const date in groupedByDate) {
//         const dayData = groupedByDate[date];
        
//         dayData.allPunches.sort((a, b) => a.id - b.id);

//         // Filter consecutive duplicates
//         const cleanedPunches = [];
//         let lastDirection = null;

//         dayData.allPunches.forEach(punch => {
//             if (punch.direction === lastDirection) {
//                 return; // Skip duplicate
//             }
//             cleanedPunches.push(punch);
//             lastDirection = punch.direction;
//         });

//         const allIns = [];
//         const allOuts = [];

//         cleanedPunches.forEach(punch => {
//             if (punch.direction === 'in') {
//                 allIns.push(punch);
//             } else if (punch.direction === 'out') {
//                 allOuts.push(punch);
//             }
//         });

//         const pairs = [];
//         const maxPairs = Math.max(allIns.length, allOuts.length);
        
//         for (let i = 0; i < maxPairs; i++) {
//             const inPunch = allIns[i];
//             const outPunch = allOuts[i];
            
//             const duration = calculateSimpleDuration(date, inPunch?.time, outPunch?.time);
            
//             pairs.push({
//                 in: inPunch ? inPunch.time : null,
//                 out: outPunch ? outPunch.time : null,
//                 duration: duration
//             });
//         }

//         let totalMinutes = 0;
//         pairs.forEach(pair => {
//             if (pair.duration && pair.duration > 0) {
//                 totalMinutes += pair.duration;
//             }
//         });

//         result.push({
//             date: date,
//             first_in: allIns[0]?.time || null,
//             last_out: allOuts[allOuts.length - 1]?.time || null,
//             pairs: pairs,
//             total_hours: (totalMinutes / 60).toFixed(2),
//             punch_count: cleanedPunches.length,
//             raw_punch_count: dayData.allPunches.length
//         });
//     }

//     result.sort((a, b) => new Date(b.date) - new Date(a.date));

//     return result;
// }

// // Calculate duration
// function calculateSimpleDuration(date, inTime, outTime) {
//     if (!inTime || !outTime) return null;

//     try {
//         const inDateTime = moment(`${date} ${inTime}`, 'YYYY-MM-DD HH:mm:ss');
//         const outDateTime = moment(`${date} ${outTime}`, 'YYYY-MM-DD HH:mm:ss');
//         const duration = outDateTime.diff(inDateTime, 'minutes');
//         return duration > 0 ? duration : null;
//     } catch (error) {
//         console.error('Duration calculation error:', error);
//         return null;
//     }
// }

// // Get employee details
// async function getEmployeeDetails(employeeCodes) {
//     if (employeeCodes.length === 0) return {};

//     const placeholders = employeeCodes.map(() => '?').join(',');
//     const [employees] = await pool.query(
//         `SELECT u.employee_id, u.name, e.designation, d.department_name
//          FROM users u
//          JOIN employees e ON u.id = e.user_id
//          LEFT JOIN departments d ON e.department_id = d.id
//          WHERE u.employee_id IN (${placeholders})`,
//         employeeCodes
//     );

//     const employeeMap = {};
//     employees.forEach(emp => {
//         employeeMap[emp.employee_id] = emp;
//     });

//     return employeeMap;
// }
