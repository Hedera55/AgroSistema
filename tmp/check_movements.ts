
import { db } from './src/services/db';

async function checkMovements() {
    console.log('--- Movement Campaign ID Check ---');
    const movements = await db.getAll('movements');
    const campaigns = await db.getAll('campaigns');
    
    console.log(`Found ${movements.length} movements and ${campaigns.length} campaigns.`);
    
    movements.forEach(m => {
        if (!m.deleted) {
            console.log(`Movement: ${m.id} | Type: ${m.type} | Date: ${m.date} | CampaignId: ${m.campaignId}`);
            if (m.campaignId) {
                const camp = campaigns.find(c => c.id === m.campaignId);
                console.log(`  -> Campaign Name: ${camp ? camp.name : 'NOT FOUND'}`);
            }
        }
    });
}

checkMovements().catch(console.error);
