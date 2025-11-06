


// controllers/calendarController.js
import db from '../config/db.js';

// controllers/calendarController.js



// export const getCalendarEvents = async (req, res) => {
//     try {
//         const { month, year } = req.query;
//         const userId = req.user.id;

//         // Get employee details and role
//         const [employee] = await db.query(`
//             SELECT 
//                 e.id as employee_id, 
//                 e.role_id, 
//                 r.role_name,
//                 e.reporting_manager_id
//             FROM employees e
//             JOIN users u ON e.user_id = u.id
//             JOIN roles r ON e.role_id = r.id
//             WHERE u.id = ?
//         `, [userId]);

//         if (!employee || employee.length === 0) {
//             return res.status(404).json({
//                 success: false,
//                 message: 'Employee not found'
//             });
//         }

//         const currentEmployee = employee[0];
//         const roleName = currentEmployee.role_name.toUpperCase();

//         let leaveQuery = '';
//         let queryParams = [];

//         // Build query based on role
//         if (roleName === 'HR' || roleName === 'SUPER ADMIN' || roleName === 'MANAGER') {
//             leaveQuery = `
//                 SELECT 
//                     la.id,
//                     la.employee_id,
//                     la.from_date as date,
//                     la.to_date,
//                     lt.leave_name as title,
//                     'leave' as type,
//                     u.name as employee_name,
//                     e.department_id,
//                     la.status,
//                     la.number_of_days
//                 FROM leave_applications la
//                 JOIN employees e ON la.employee_id = e.id
//                 JOIN users u ON e.user_id = u.id
//                 JOIN leave_types lt ON la.leave_type_id = lt.id
//                 WHERE MONTH(la.from_date) = ? 
//                 AND YEAR(la.from_date) = ?
//                 AND la.status = 'approved'
//                 ORDER BY la.from_date
//             `;
//             queryParams = [month, year];
            
//         } else if (roleName === 'TL') {
//             leaveQuery = `
//                 SELECT 
//                     la.id,
//                     la.employee_id,
//                     la.from_date as date,
//                     la.to_date,
//                     lt.leave_name as title,
//                     'leave' as type,
//                     u.name as employee_name,
//                     e.department_id,
//                     la.status,
//                     la.number_of_days
//                 FROM leave_applications la
//                 JOIN employees e ON la.employee_id = e.id
//                 JOIN users u ON e.user_id = u.id
//                 JOIN leave_types lt ON la.leave_type_id = lt.id
//                 WHERE MONTH(la.from_date) = ? 
//                 AND YEAR(la.from_date) = ?
//                 AND la.status = 'approved'
//                 AND (
//                     e.reporting_manager_id = ? 
//                     OR la.employee_id = ?
//                 )
//                 ORDER BY la.from_date
//             `;
//             queryParams = [month, year, currentEmployee.employee_id, currentEmployee.employee_id];
            
//         } else {
//             leaveQuery = `
//                 SELECT 
//                     la.id,
//                     la.employee_id,
//                     la.from_date as date,
//                     la.to_date,
//                     lt.leave_name as title,
//                     'leave' as type,
//                     u.name as employee_name,
//                     e.department_id,
//                     la.status,
//                     la.number_of_days
//                 FROM leave_applications la
//                 JOIN employees e ON la.employee_id = e.id
//                 JOIN users u ON e.user_id = u.id
//                 JOIN leave_types lt ON la.leave_type_id = lt.id
//                 WHERE MONTH(la.from_date) = ? 
//                 AND YEAR(la.from_date) = ?
//                 AND la.status = 'approved'
//                 AND la.employee_id = ?
//                 ORDER BY la.from_date
//             `;
//             queryParams = [month, year, currentEmployee.employee_id];
//         }

//         const [leaveResults] = await db.query(leaveQuery, queryParams);

//         // Get birthdays with same role-based logic
//         let birthdayQuery = '';
//         let birthdayParams = [];

//         if (roleName === 'HR' || roleName === 'SUPER ADMIN' || roleName === 'MANAGER') {
//             birthdayQuery = `
//                 SELECT 
//                     e.id,
//                     e.id as employee_id,
//                     DATE_FORMAT(
//                         CONCAT(?, '-', LPAD(MONTH(e.date_of_birth), 2, '0'), '-', LPAD(DAY(e.date_of_birth), 2, '0')),
//                         '%Y-%m-%d'
//                     ) as date,
//                     NULL as to_date,
//                     CONCAT(u.name, "'s Birthday") as title,
//                     'birthday' as type,
//                     u.name as employee_name,
//                     e.department_id
//                 FROM employees e
//                 JOIN users u ON e.user_id = u.id
//                 WHERE MONTH(e.date_of_birth) = ?
//                 AND e.is_active = TRUE
//                 ORDER BY DAY(e.date_of_birth)
//             `;
//             birthdayParams = [year, month];
            
//         } else if (roleName === 'TL') {
//             birthdayQuery = `
//                 SELECT 
//                     e.id,
//                     e.id as employee_id,
//                     DATE_FORMAT(
//                         CONCAT(?, '-', LPAD(MONTH(e.date_of_birth), 2, '0'), '-', LPAD(DAY(e.date_of_birth), 2, '0')),
//                         '%Y-%m-%d'
//                     ) as date,
//                     NULL as to_date,
//                     CONCAT(u.name, "'s Birthday") as title,
//                     'birthday' as type,
//                     u.name as employee_name,
//                     e.department_id
//                 FROM employees e
//                 JOIN users u ON e.user_id = u.id
//                 WHERE MONTH(e.date_of_birth) = ?
//                 AND e.is_active = TRUE
//                 AND (
//                     e.reporting_manager_id = ?
//                     OR e.id = ?
//                 )
//                 ORDER BY DAY(e.date_of_birth)
//             `;
//             birthdayParams = [year, month, currentEmployee.employee_id, currentEmployee.employee_id];
            
//         } else {
//             birthdayQuery = `
//                 SELECT 
//                     e.id,
//                     e.id as employee_id,
//                     DATE_FORMAT(
//                         CONCAT(?, '-', LPAD(MONTH(e.date_of_birth), 2, '0'), '-', LPAD(DAY(e.date_of_birth), 2, '0')),
//                         '%Y-%m-%d'
//                     ) as date,
//                     NULL as to_date,
//                     CONCAT(u.name, "'s Birthday") as title,
//                     'birthday' as type,
//                     u.name as employee_name,
//                     e.department_id
//                 FROM employees e
//                 JOIN users u ON e.user_id = u.id
//                 WHERE MONTH(e.date_of_birth) = ?
//                 AND e.is_active = TRUE
//                 AND e.id = ?
//                 ORDER BY DAY(e.date_of_birth)
//             `;
//             birthdayParams = [year, month, currentEmployee.employee_id];
//         }

//         const [birthdayResults] = await db.query(birthdayQuery, birthdayParams);

//         // ========== Calculate Working Hours with Holiday Deduction ==========
        
//         // Get working days in the month (excluding weekends)
//         const [workingDaysResult] = await db.query(`
//             WITH RECURSIVE date_range AS (
//                 SELECT DATE(CONCAT(?, '-', LPAD(?, 2, '0'), '-01')) as date
//                 UNION ALL
//                 SELECT DATE_ADD(date, INTERVAL 1 DAY)
//                 FROM date_range
//                 WHERE MONTH(DATE_ADD(date, INTERVAL 1 DAY)) = ?
//             )
//             SELECT COUNT(*) as working_days
//             FROM date_range
//             WHERE DAYOFWEEK(date) NOT IN (1, 7)
//         `, [year, month, month]);

//         const workingDays = workingDaysResult[0].working_days;

//         // Get number of holidays in this month (excluding weekends) from public_holidays table
//         const [holidaysResult] = await db.query(`
//             SELECT COUNT(*) as holiday_count
//             FROM public_holidays
//             WHERE MONTH(holiday_date) = ?
//             AND YEAR(holiday_date) = ?
//             AND DAYOFWEEK(holiday_date) NOT IN (1, 7)
//         `, [month, year]);

//         const holidayCount = holidaysResult[0].holiday_count;
        
//         const dailyWorkingHours = 8;
//         const totalExpectedHours = workingDays * dailyWorkingHours;
//         const holidayHours = holidayCount * dailyWorkingHours;

//         // Calculate working hours insights based on role
//         let insightsQuery = '';
//         let insightsParams = [];

//         if (roleName === 'HR' || roleName === 'SUPER ADMIN' || roleName === 'MANAGER') {
//             insightsQuery = `
//                 SELECT 
//                     e.id as employee_id,
//                     u.name as employee_name,
//                     COALESCE(SUM(la.number_of_days), 0) as total_leave_days,
//                     ? as working_days,
//                     ? as holiday_count,
//                     ? as daily_working_hours,
//                     ? as total_expected_hours,
//                     ? as holiday_hours,
//                     (? - ? - COALESCE(SUM(la.number_of_days), 0) * ?) as actual_working_hours
//                 FROM employees e
//                 JOIN users u ON e.user_id = u.id
//                 LEFT JOIN leave_applications la ON e.id = la.employee_id 
//                     AND MONTH(la.from_date) = ? 
//                     AND YEAR(la.from_date) = ?
//                     AND la.status = 'approved'
//                 WHERE e.is_active = TRUE
//                 GROUP BY e.id, u.name
//                 ORDER BY u.name
//             `;
//             insightsParams = [
//                 workingDays,
//                 holidayCount,
//                 dailyWorkingHours,
//                 totalExpectedHours,
//                 holidayHours,
//                 totalExpectedHours,
//                 holidayHours,
//                 dailyWorkingHours,
//                 month,
//                 year
//             ];
            
//         } else if (roleName === 'TL') {
//             insightsQuery = `
//                 SELECT 
//                     e.id as employee_id,
//                     u.name as employee_name,
//                     COALESCE(SUM(la.number_of_days), 0) as total_leave_days,
//                     ? as working_days,
//                     ? as holiday_count,
//                     ? as daily_working_hours,
//                     ? as total_expected_hours,
//                     ? as holiday_hours,
//                     (? - ? - COALESCE(SUM(la.number_of_days), 0) * ?) as actual_working_hours
//                 FROM employees e
//                 JOIN users u ON e.user_id = u.id
//                 LEFT JOIN leave_applications la ON e.id = la.employee_id 
//                     AND MONTH(la.from_date) = ? 
//                     AND YEAR(la.from_date) = ?
//                     AND la.status = 'approved'
//                 WHERE e.is_active = TRUE
//                 AND (
//                     e.reporting_manager_id = ?
//                     OR e.id = ?
//                 )
//                 GROUP BY e.id, u.name
//                 ORDER BY u.name
//             `;
//             insightsParams = [
//                 workingDays,
//                 holidayCount,
//                 dailyWorkingHours,
//                 totalExpectedHours,
//                 holidayHours,
//                 totalExpectedHours,
//                 holidayHours,
//                 dailyWorkingHours,
//                 month,
//                 year,
//                 currentEmployee.employee_id,
//                 currentEmployee.employee_id
//             ];
            
//         } else {
//             insightsQuery = `
//                 SELECT 
//                     e.id as employee_id,
//                     u.name as employee_name,
//                     COALESCE(SUM(la.number_of_days), 0) as total_leave_days,
//                     ? as working_days,
//                     ? as holiday_count,
//                     ? as daily_working_hours,
//                     ? as total_expected_hours,
//                     ? as holiday_hours,
//                     (? - ? - COALESCE(SUM(la.number_of_days), 0) * ?) as actual_working_hours
//                 FROM employees e
//                 JOIN users u ON e.user_id = u.id
//                 LEFT JOIN leave_applications la ON e.id = la.employee_id 
//                     AND MONTH(la.from_date) = ? 
//                     AND YEAR(la.from_date) = ?
//                     AND la.status = 'approved'
//                 WHERE e.is_active = TRUE
//                 AND e.id = ?
//                 GROUP BY e.id, u.name
//             `;
//             insightsParams = [
//                 workingDays,
//                 holidayCount,
//                 dailyWorkingHours,
//                 totalExpectedHours,
//                 holidayHours,
//                 totalExpectedHours,
//                 holidayHours,
//                 dailyWorkingHours,
//                 month,
//                 year,
//                 currentEmployee.employee_id
//             ];
//         }

//         const [insightsResults] = await db.query(insightsQuery, insightsParams);

//         // Combine results
//         const allEvents = [...leaveResults, ...birthdayResults];

//         res.json({
//             success: true,
//             data: allEvents,
//             role: roleName,
//             count: allEvents.length,
//             insights: {
//                 month: month,
//                 year: year,
//                 working_days: workingDays,
//                 holiday_count: holidayCount,
//                 daily_working_hours: dailyWorkingHours,
//                 total_expected_hours: totalExpectedHours,
//                 holiday_hours: holidayHours,
//                 net_working_hours: totalExpectedHours - holidayHours,
//                 employees: insightsResults
//             }
//         });

//     } catch (error) {
//         console.error('Error fetching calendar events:', error);
//         res.status(500).json({
//             success: false,
//             message: 'Error fetching calendar events',
//             error: error.message
//         });
//     }
// };



export const getCalendarEvents = async (req, res) => {
    try {
        const { month, year } = req.query;
        const userId = req.user.id;

        // Get employee details and role
        const [employee] = await db.query(`
            SELECT 
                e.id as employee_id, 
                e.role_id, 
                r.role_name,
                e.reporting_manager_id
            FROM employees e
            JOIN users u ON e.user_id = u.id
            JOIN roles r ON e.role_id = r.id
            WHERE u.id = ?
        `, [userId]);

        if (!employee || employee.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Employee not found'
            });
        }

        const currentEmployee = employee[0];
        const roleName = currentEmployee.role_name.toUpperCase();

        let leaveQuery = '';
        let queryParams = [];

        // Build query based on role
        if (roleName === 'HR' || roleName === 'SUPER ADMIN' || roleName === 'MANAGER') {
            leaveQuery = `
                SELECT 
                    la.id,
                    la.employee_id,
                    la.from_date as date,
                    la.to_date,
                    lt.leave_name as title,
                    'leave' as type,
                    u.name as employee_name,
                    e.department_id,
                    la.status,
                    la.number_of_days
                FROM leave_applications la
                JOIN employees e ON la.employee_id = e.id
                JOIN users u ON e.user_id = u.id
                JOIN leave_types lt ON la.leave_type_id = lt.id
                WHERE MONTH(la.from_date) = ? 
                AND YEAR(la.from_date) = ?
                AND la.status = 'approved'
                ORDER BY la.from_date
            `;
            queryParams = [month, year];
            
        } else if (roleName === 'TL') {
            leaveQuery = `
                SELECT 
                    la.id,
                    la.employee_id,
                    la.from_date as date,
                    la.to_date,
                    lt.leave_name as title,
                    'leave' as type,
                    u.name as employee_name,
                    e.department_id,
                    la.status,
                    la.number_of_days
                FROM leave_applications la
                JOIN employees e ON la.employee_id = e.id
                JOIN users u ON e.user_id = u.id
                JOIN leave_types lt ON la.leave_type_id = lt.id
                WHERE MONTH(la.from_date) = ? 
                AND YEAR(la.from_date) = ?
                AND la.status = 'approved'
                AND (
                    e.reporting_manager_id = ? 
                    OR la.employee_id = ?
                )
                ORDER BY la.from_date
            `;
            queryParams = [month, year, currentEmployee.employee_id, currentEmployee.employee_id];
            
        } else {
            leaveQuery = `
                SELECT 
                    la.id,
                    la.employee_id,
                    la.from_date as date,
                    la.to_date,
                    lt.leave_name as title,
                    'leave' as type,
                    u.name as employee_name,
                    e.department_id,
                    la.status,
                    la.number_of_days
                FROM leave_applications la
                JOIN employees e ON la.employee_id = e.id
                JOIN users u ON e.user_id = u.id
                JOIN leave_types lt ON la.leave_type_id = lt.id
                WHERE MONTH(la.from_date) = ? 
                AND YEAR(la.from_date) = ?
                AND la.status = 'approved'
                AND la.employee_id = ?
                ORDER BY la.from_date
            `;
            queryParams = [month, year, currentEmployee.employee_id];
        }

        const [leaveResults] = await db.query(leaveQuery, queryParams);

        // Get birthdays with same role-based logic
        let birthdayQuery = '';
        let birthdayParams = [];

        if (roleName === 'HR' || roleName === 'SUPER ADMIN' || roleName === 'MANAGER') {
            birthdayQuery = `
                SELECT 
                    e.id,
                    e.id as employee_id,
                    DATE_FORMAT(
                        CONCAT(?, '-', LPAD(MONTH(e.date_of_birth), 2, '0'), '-', LPAD(DAY(e.date_of_birth), 2, '0')),
                        '%Y-%m-%d'
                    ) as date,
                    NULL as to_date,
                    CONCAT(u.name, "'s Birthday") as title,
                    'birthday' as type,
                    u.name as employee_name,
                    e.department_id
                FROM employees e
                JOIN users u ON e.user_id = u.id
                WHERE MONTH(e.date_of_birth) = ?
                AND e.is_active = TRUE
                ORDER BY DAY(e.date_of_birth)
            `;
            birthdayParams = [year, month];
            
        } else if (roleName === 'TL') {
            birthdayQuery = `
                SELECT 
                    e.id,
                    e.id as employee_id,
                    DATE_FORMAT(
                        CONCAT(?, '-', LPAD(MONTH(e.date_of_birth), 2, '0'), '-', LPAD(DAY(e.date_of_birth), 2, '0')),
                        '%Y-%m-%d'
                    ) as date,
                    NULL as to_date,
                    CONCAT(u.name, "'s Birthday") as title,
                    'birthday' as type,
                    u.name as employee_name,
                    e.department_id
                FROM employees e
                JOIN users u ON e.user_id = u.id
                WHERE MONTH(e.date_of_birth) = ?
                AND e.is_active = TRUE
                AND (
                    e.reporting_manager_id = ?
                    OR e.id = ?
                )
                ORDER BY DAY(e.date_of_birth)
            `;
            birthdayParams = [year, month, currentEmployee.employee_id, currentEmployee.employee_id];
            
        } else {
            birthdayQuery = `
                SELECT 
                    e.id,
                    e.id as employee_id,
                    DATE_FORMAT(
                        CONCAT(?, '-', LPAD(MONTH(e.date_of_birth), 2, '0'), '-', LPAD(DAY(e.date_of_birth), 2, '0')),
                        '%Y-%m-%d'
                    ) as date,
                    NULL as to_date,
                    CONCAT(u.name, "'s Birthday") as title,
                    'birthday' as type,
                    u.name as employee_name,
                    e.department_id
                FROM employees e
                JOIN users u ON e.user_id = u.id
                WHERE MONTH(e.date_of_birth) = ?
                AND e.is_active = TRUE
                AND e.id = ?
                ORDER BY DAY(e.date_of_birth)
            `;
            birthdayParams = [year, month, currentEmployee.employee_id];
        }

        const [birthdayResults] = await db.query(birthdayQuery, birthdayParams);

        // ========== Calculate MONTHLY Working Hours with Holiday Deduction ==========
        
        // Get working days in the month (excluding weekends)
        const [workingDaysResult] = await db.query(`
            WITH RECURSIVE date_range AS (
                SELECT DATE(CONCAT(?, '-', LPAD(?, 2, '0'), '-01')) as date
                UNION ALL
                SELECT DATE_ADD(date, INTERVAL 1 DAY)
                FROM date_range
                WHERE MONTH(DATE_ADD(date, INTERVAL 1 DAY)) = ?
            )
            SELECT COUNT(*) as working_days
            FROM date_range
            WHERE DAYOFWEEK(date) NOT IN (1, 7)
        `, [year, month, month]);

        const workingDays = workingDaysResult[0].working_days;

        // Get number of holidays in this month (excluding weekends) from public_holidays table
        const [holidaysResult] = await db.query(`
            SELECT COUNT(*) as holiday_count
            FROM public_holidays
            WHERE MONTH(holiday_date) = ?
            AND YEAR(holiday_date) = ?
            AND DAYOFWEEK(holiday_date) NOT IN (1, 7)
        `, [month, year]);

        const holidayCount = holidaysResult[0].holiday_count;
        
        const dailyWorkingHours = 8;
        const totalExpectedHours = workingDays * dailyWorkingHours;
        const holidayHours = holidayCount * dailyWorkingHours;

        // Calculate working hours insights based on role (MONTHLY)
        let insightsQuery = '';
        let insightsParams = [];

        if (roleName === 'HR' || roleName === 'SUPER ADMIN' || roleName === 'MANAGER') {
            insightsQuery = `
                SELECT 
                    e.id as employee_id,
                    u.name as employee_name,
                    COALESCE(SUM(la.number_of_days), 0) as total_leave_days,
                    ? as working_days,
                    ? as holiday_count,
                    ? as daily_working_hours,
                    ? as total_expected_hours,
                    ? as holiday_hours,
                    (? - ? - COALESCE(SUM(la.number_of_days), 0) * ?) as actual_working_hours
                FROM employees e
                JOIN users u ON e.user_id = u.id
                LEFT JOIN leave_applications la ON e.id = la.employee_id 
                    AND MONTH(la.from_date) = ? 
                    AND YEAR(la.from_date) = ?
                    AND la.status = 'approved'
                WHERE e.is_active = TRUE
                GROUP BY e.id, u.name
                ORDER BY u.name
            `;
            insightsParams = [
                workingDays,
                holidayCount,
                dailyWorkingHours,
                totalExpectedHours,
                holidayHours,
                totalExpectedHours,
                holidayHours,
                dailyWorkingHours,
                month,
                year
            ];
            
        } else if (roleName === 'TL') {
            insightsQuery = `
                SELECT 
                    e.id as employee_id,
                    u.name as employee_name,
                    COALESCE(SUM(la.number_of_days), 0) as total_leave_days,
                    ? as working_days,
                    ? as holiday_count,
                    ? as daily_working_hours,
                    ? as total_expected_hours,
                    ? as holiday_hours,
                    (? - ? - COALESCE(SUM(la.number_of_days), 0) * ?) as actual_working_hours
                FROM employees e
                JOIN users u ON e.user_id = u.id
                LEFT JOIN leave_applications la ON e.id = la.employee_id 
                    AND MONTH(la.from_date) = ? 
                    AND YEAR(la.from_date) = ?
                    AND la.status = 'approved'
                WHERE e.is_active = TRUE
                AND (
                    e.reporting_manager_id = ?
                    OR e.id = ?
                )
                GROUP BY e.id, u.name
                ORDER BY u.name
            `;
            insightsParams = [
                workingDays,
                holidayCount,
                dailyWorkingHours,
                totalExpectedHours,
                holidayHours,
                totalExpectedHours,
                holidayHours,
                dailyWorkingHours,
                month,
                year,
                currentEmployee.employee_id,
                currentEmployee.employee_id
            ];
            
        } else {
            insightsQuery = `
                SELECT 
                    e.id as employee_id,
                    u.name as employee_name,
                    COALESCE(SUM(la.number_of_days), 0) as total_leave_days,
                    ? as working_days,
                    ? as holiday_count,
                    ? as daily_working_hours,
                    ? as total_expected_hours,
                    ? as holiday_hours,
                    (? - ? - COALESCE(SUM(la.number_of_days), 0) * ?) as actual_working_hours
                FROM employees e
                JOIN users u ON e.user_id = u.id
                LEFT JOIN leave_applications la ON e.id = la.employee_id 
                    AND MONTH(la.from_date) = ? 
                    AND YEAR(la.from_date) = ?
                    AND la.status = 'approved'
                WHERE e.is_active = TRUE
                AND e.id = ?
                GROUP BY e.id, u.name
            `;
            insightsParams = [
                workingDays,
                holidayCount,
                dailyWorkingHours,
                totalExpectedHours,
                holidayHours,
                totalExpectedHours,
                holidayHours,
                dailyWorkingHours,
                month,
                year,
                currentEmployee.employee_id
            ];
        }

        const [insightsResults] = await db.query(insightsQuery, insightsParams);

        // ========== Calculate WEEKLY Working Hours with Holiday & Leave Deduction ==========
        
        // Get all weeks in the month
        const [weeksResult] = await db.query(`
            WITH RECURSIVE date_range AS (
                SELECT DATE(CONCAT(?, '-', LPAD(?, 2, '0'), '-01')) as date
                UNION ALL
                SELECT DATE_ADD(date, INTERVAL 1 DAY)
                FROM date_range
                WHERE MONTH(DATE_ADD(date, INTERVAL 1 DAY)) = ?
            )
            SELECT 
                WEEK(date, 1) as week_number,
                MIN(date) as week_start,
                MAX(date) as week_end,
                COUNT(CASE WHEN DAYOFWEEK(date) NOT IN (1, 7) THEN 1 END) as working_days_in_week
            FROM date_range
            GROUP BY WEEK(date, 1)
            ORDER BY week_start
        `, [year, month, month]);

        // Calculate weekly insights for each employee
        const weeklyInsights = [];
        
        for (const week of weeksResult) {
            // Get holidays count for this week
            const [weekHolidaysResult] = await db.query(`
                SELECT COUNT(*) as holiday_count
                FROM public_holidays
                WHERE holiday_date BETWEEN ? AND ?
                AND DAYOFWEEK(holiday_date) NOT IN (1, 7)
            `, [week.week_start, week.week_end]);
            
            const weekHolidayCount = weekHolidaysResult[0].holiday_count;
            const weekHolidayHours = weekHolidayCount * dailyWorkingHours;
            const weekTotalExpectedHours = week.working_days_in_week * dailyWorkingHours;

            // Get leave data for this week based on role
            let weekLeaveQuery = '';
            let weekLeaveParams = [];

            if (roleName === 'HR' || roleName === 'SUPER ADMIN' || roleName === 'MANAGER') {
                weekLeaveQuery = `
                    SELECT 
                        e.id as employee_id,
                        u.name as employee_name,
                        SUM(
                            CASE 
                                WHEN la.from_date < ? THEN
                                    CASE 
                                        WHEN la.to_date > ? THEN DATEDIFF(?, ?) + 1
                                        ELSE DATEDIFF(la.to_date, ?) + 1
                                    END
                                ELSE
                                    CASE 
                                        WHEN la.to_date > ? THEN DATEDIFF(?, la.from_date) + 1
                                        ELSE DATEDIFF(la.to_date, la.from_date) + 1
                                    END
                            END
                        ) as leave_days_in_week
                    FROM employees e
                    JOIN users u ON e.user_id = u.id
                    LEFT JOIN leave_applications la ON e.id = la.employee_id
                        AND la.status = 'approved'
                        AND la.from_date <= ?
                        AND la.to_date >= ?
                    WHERE e.is_active = TRUE
                    GROUP BY e.id, u.name
                `;
                weekLeaveParams = [
                    week.week_start, week.week_end, week.week_end, week.week_start,
                    week.week_start, week.week_end, week.week_end,
                    week.week_end, week.week_start
                ];
                
            } else if (roleName === 'TL') {
                weekLeaveQuery = `
                    SELECT 
                        e.id as employee_id,
                        u.name as employee_name,
                        SUM(
                            CASE 
                                WHEN la.from_date < ? THEN
                                    CASE 
                                        WHEN la.to_date > ? THEN DATEDIFF(?, ?) + 1
                                        ELSE DATEDIFF(la.to_date, ?) + 1
                                    END
                                ELSE
                                    CASE 
                                        WHEN la.to_date > ? THEN DATEDIFF(?, la.from_date) + 1
                                        ELSE DATEDIFF(la.to_date, la.from_date) + 1
                                    END
                            END
                        ) as leave_days_in_week
                    FROM employees e
                    JOIN users u ON e.user_id = u.id
                    LEFT JOIN leave_applications la ON e.id = la.employee_id
                        AND la.status = 'approved'
                        AND la.from_date <= ?
                        AND la.to_date >= ?
                    WHERE e.is_active = TRUE
                    AND (
                        e.reporting_manager_id = ?
                        OR e.id = ?
                    )
                    GROUP BY e.id, u.name
                `;
                weekLeaveParams = [
                    week.week_start, week.week_end, week.week_end, week.week_start,
                    week.week_start, week.week_end, week.week_end,
                    week.week_end, week.week_start,
                    currentEmployee.employee_id, currentEmployee.employee_id
                ];
                
            } else {
                weekLeaveQuery = `
                    SELECT 
                        e.id as employee_id,
                        u.name as employee_name,
                        SUM(
                            CASE 
                                WHEN la.from_date < ? THEN
                                    CASE 
                                        WHEN la.to_date > ? THEN DATEDIFF(?, ?) + 1
                                        ELSE DATEDIFF(la.to_date, ?) + 1
                                    END
                                ELSE
                                    CASE 
                                        WHEN la.to_date > ? THEN DATEDIFF(?, la.from_date) + 1
                                        ELSE DATEDIFF(la.to_date, la.from_date) + 1
                                    END
                            END
                        ) as leave_days_in_week
                    FROM employees e
                    JOIN users u ON e.user_id = u.id
                    LEFT JOIN leave_applications la ON e.id = la.employee_id
                        AND la.status = 'approved'
                        AND la.from_date <= ?
                        AND la.to_date >= ?
                    WHERE e.is_active = TRUE
                    AND e.id = ?
                    GROUP BY e.id, u.name
                `;
                weekLeaveParams = [
                    week.week_start, week.week_end, week.week_end, week.week_start,
                    week.week_start, week.week_end, week.week_end,
                    week.week_end, week.week_start,
                    currentEmployee.employee_id
                ];
            }

            const [weekLeaveResults] = await db.query(weekLeaveQuery, weekLeaveParams);

            // Calculate actual working hours for each employee
            const employeesWeekData = weekLeaveResults.map(emp => {
                const leaveDays = emp.leave_days_in_week || 0;
                const leaveHours = leaveDays * dailyWorkingHours;
                const actualWorkingHours = weekTotalExpectedHours - weekHolidayHours - leaveHours;

                return {
                    employee_id: emp.employee_id,
                    employee_name: emp.employee_name,
                    leave_days: leaveDays,
                    leave_hours: leaveHours,
                    actual_working_hours: actualWorkingHours
                };
            });

            weeklyInsights.push({
                week_number: week.week_number,
                week_start: week.week_start,
                week_end: week.week_end,
                working_days: week.working_days_in_week,
                holiday_count: weekHolidayCount,
                daily_working_hours: dailyWorkingHours,
                total_expected_hours: weekTotalExpectedHours,
                holiday_hours: weekHolidayHours,
                net_working_hours: weekTotalExpectedHours - weekHolidayHours,
                employees: employeesWeekData
            });
        }

        // Combine results
        const allEvents = [...leaveResults, ...birthdayResults];

        res.json({
            success: true,
            data: allEvents,
            role: roleName,
            count: allEvents.length,
            insights: {
                month: month,
                year: year,
                working_days: workingDays,
                holiday_count: holidayCount,
                daily_working_hours: dailyWorkingHours,
                total_expected_hours: totalExpectedHours,
                holiday_hours: holidayHours,
                net_working_hours: totalExpectedHours - holidayHours,
                employees: insightsResults
            },
            weekly_insights: weeklyInsights
        });

    } catch (error) {
        console.error('Error fetching calendar events:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching calendar events',
            error: error.message
        });
    }
};
