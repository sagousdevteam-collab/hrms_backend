// jobs/attendancecronJobs.js
import cron from 'node-cron';


import { syncAttendanceData } from '../controllers/syncController.js';
const createMockReqRes = () => {
    const req = {};
    const res = {
        json: (data) => {
            console.log('✅ Attendance Sync Result:', JSON.stringify(data, null, 2));
        },
        status: (code) => ({
            json: (data) => {
                console.error(`❌ Attendance Sync Error ${code}:`, JSON.stringify(data, null, 2));
            }
        })
    };
    return { req, res };
};

export const scheduleAttendanceSync = () => {
    console.log('═══════════════════════════════════════');
    console.log('🚀 Attendance Sync Cron Initialization');
    console.log('Current Server Time:', new Date().toString());
    console.log('Current IST Time:', new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }));
    console.log('═══════════════════════════════════════');

    // TEST: Run every 2 minutes to verify it's working
// const testTask = cron.schedule('* * * * *', async () => {
    
//     console.log('\n🔔 TEST CRON TRIGGERED');
//         console.log('Time:', new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }));
        
//         try {
//             const { req, res } = createMockReqRes();
//             await syncAttendanceData(req, res);
//         } catch (error) {
//             console.error('❌ Test cron execution error:', error);
//         }
//     }, {
//         scheduled: true,
//         timezone: "Asia/Kolkata"
//     });

    // PRODUCTION: Daily at 7 AM IST
    const dailyTask = cron.schedule('0 7 * * *', async () => {
        console.log('\n⏰ DAILY ATTENDANCE SYNC STARTED');
        console.log('Time:', new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }));
        
        try {
            const { req, res } = createMockReqRes();
            await syncAttendanceData(req, res);
        } catch (error) {
            console.error('❌ Daily cron execution error:', error);
        }
    }, {
        scheduled: true,
        timezone: "Asia/Kolkata"
    });

    console.log('✅ Test cron scheduled: Every 2 minutes');
    console.log('✅ Production cron scheduled: 7:00 AM IST daily');
    console.log('═══════════════════════════════════════');
    
    return {  dailyTask };
};
