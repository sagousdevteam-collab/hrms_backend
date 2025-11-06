// import cron from 'node-cron';
// import moment from 'moment';
// import { sendIndividualReports } from '../controllers/mailattendanceController.js';

// const executeIndividualReports = async () => {
//     console.log(`\n${'='.repeat(60)}`);
//     console.log(`[${moment().format('DD-MM-YYYY HH:mm:ss')}] 🚀 Sending individual reports to all employees...`);
//     console.log(`${'='.repeat(60)}\n`);
    
//     try {
//         // Send individual reports for 2 days ago
//         await sendIndividualReports({ user: null }, null, 2);
        
//         console.log(`\n${'='.repeat(60)}`);
//         console.log(`[${moment().format('DD-MM-YYYY HH:mm:ss')}] ✅ All individual reports sent successfully`);
//         console.log(`${'='.repeat(60)}\n`);
//     } catch (error) {
//         console.error(`\n${'='.repeat(60)}`);
//         console.error(`[${moment().format('DD-MM-YYYY HH:mm:ss')}] ❌ Failed:`, error.message);
//         console.error(`${'='.repeat(60)}\n`);
//     }
// };

// export const initializeScheduledJobs = () => {
//     // Send individual reports at 6:00 PM IST every day
//     cron.schedule('14 20 * * *', executeIndividualReports, {
//         timezone: "Asia/Kolkata"
//     });

//     console.log('\n📧 Scheduled Jobs Initialized:');
//     console.log('   ✓ Individual Reports: Every day at 6:00 PM IST');
//     console.log('   ✓ Report shows: Data from 2 days before');
//     console.log('   ✓ Sent to: Each employee individually');
//     console.log('   ✓ Timezone: Asia/Kolkata (IST)\n');
// };


import cron from 'node-cron';
import moment from 'moment';
import cluster from 'cluster';
import { sendIndividualReports } from '../controllers/mailattendanceController.js';

// Execution lock to prevent overlapping runs
let isExecuting = false;
let lastExecutionTime = null;

const getPreviousWorkingDay = () => {
    let daysAgo = 1;
    
    // If today is Monday (1), get Friday's report (3 days ago)
    if (moment().isoWeekday() === 1) {
        daysAgo = 3;
    }
    // If today is Sunday (7), get Friday's report (2 days ago)
    else if (moment().isoWeekday() === 7) {
        daysAgo = 2;
    }
    // For any other day, just get yesterday
    else {
        daysAgo = 1;
    }
    
    return daysAgo;
};

const executeIndividualReports = async () => {
    // Prevent overlapping executions
    if (isExecuting) {
        console.log(`⏭️  [${moment().format('DD-MM-YYYY HH:mm:ss')}] ⚠️  Job already running, skipping...`);
        return;
    }

    // Check if job ran in last 55 minutes (safety check)
    if (lastExecutionTime) {
        const timeDiff = moment().diff(lastExecutionTime, 'minutes');
        if (timeDiff < 55) {
            console.log(`⏭️  [${moment().format('DD-MM-YYYY HH:mm:ss')}] ⚠️  Job ran ${timeDiff} minutes ago, skipping...`);
            return;
        }
    }

    isExecuting = true;
    const daysAgo = getPreviousWorkingDay();
    const reportDate = moment().subtract(daysAgo, 'days').format('DD-MM-YYYY');
    
    console.log(`\n${'='.repeat(60)}`);
    console.log(`[${moment().format('DD-MM-YYYY HH:mm:ss')}] 🚀 Sending individual reports...`);
    console.log(`📅 Report Date: ${reportDate} (${daysAgo} day(s) ago)`);
    console.log(`🔧 Instance: ${cluster.isPrimary ? 'Primary' : `Worker ${cluster.worker.id}`}`);
    console.log(`${'='.repeat(60)}\n`);
    
    try {
        await sendIndividualReports({ user: null }, null, daysAgo);
        
        console.log(`\n${'='.repeat(60)}`);
        console.log(`[${moment().format('DD-MM-YYYY HH:mm:ss')}] ✅ All individual reports sent successfully`);
        console.log(`${'='.repeat(60)}\n`);
        
        lastExecutionTime = moment();
    } catch (error) {
        console.error(`\n${'='.repeat(60)}`);
        console.error(`[${moment().format('DD-MM-YYYY HH:mm:ss')}] ❌ Failed:`, error.message);
        console.error(`Stack:`, error.stack);
        console.error(`${'='.repeat(60)}\n`);
    } finally {
        isExecuting = false;
    }
};

export const initializeScheduledJobs = () => {
    // Only initialize cron on primary instance (cluster mode) or in fork mode
    if (cluster.isPrimary || !cluster.isMaster) {
        console.log(`\n${'='.repeat(60)}`);
        console.log('📧 Initializing Scheduled Jobs...');
        console.log(`🔧 Cluster Mode: ${cluster.isPrimary ? 'Primary Instance' : 'Worker Instance'}`);
        console.log(`${'='.repeat(60)}\n`);

        // Schedule: Send individual reports at 6:00 PM IST every day (Monday to Friday only)
<<<<<<< HEAD
        cron.schedule('44 13 * * 1-5', executeIndividualReports, {
=======
        cron.schedule('38 15 * * 1-5', executeIndividualReports, {
>>>>>>> 053b842 (Your message)
            timezone: "Asia/Kolkata",
            runOnInit: false  // Don't run immediately on initialization
        });

        console.log('\n📧 Scheduled Jobs Initialized:');
        console.log('   ✓ Individual Reports: Monday-Friday at 6:00 PM IST (18:00)');
        console.log('   ✓ Report Logic:');
        console.log('      - Monday: Shows Friday report');
        console.log('      - Tuesday-Friday: Shows previous day report');
        console.log('   ✓ Sent to: Each employee individually');
        console.log('   ✓ Timezone: Asia/Kolkata (IST)');
        console.log('   ✓ Duplicate Prevention: Execution lock + overlap detection');
        console.log(`   ✓ Running on: ${cluster.isPrimary ? 'Primary Instance' : `Worker ${cluster.worker.id}`}\n`);
    } else {
        console.log(`\n⏭️  [Worker ${cluster.worker.id}] Cron jobs not initialized (only on primary)`);
    }
};

export const stopScheduledJobs = () => {
    console.log('\n🛑 Stopping scheduled jobs...');
    cron.getTasks().forEach(task => task.stop());
    console.log('✅ All scheduled jobs stopped\n');
};
