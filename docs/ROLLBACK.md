# Rollback

1. Export a fresh JSON backup before a release or migration.
2. In Vercel **Deployments**, open the last known-good deployment and choose **Promote to Production**. This restores the frontend/API without requiring the PC to stay on.
3. Database migrations are additive. Do not drop tables to roll back the frontend. The prior deployment can continue using the same schema.
4. If data must be restored, use the CVFinance JSON import for this single account. For a full project incident, use a Supabase database backup/PITR appropriate to the selected plan.
5. If stock APIs fail, remove/rotate only the affected provider key and use manual current prices; Base/Optimistic targets remain unchanged.
6. If the cron is the issue, remove the `crons` block from `vercel.json` and redeploy. Manual/app-opening refresh remains available.
