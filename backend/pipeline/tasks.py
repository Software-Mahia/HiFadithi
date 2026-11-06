"""Background work for the 3D pipeline. Owner: C.

There is NO background worker (Render's free plan has none). Instead:
- the Meshy webhook copies the finished GLB inside its own request (services.refresh_job);
- cron-job.org calls /api/jobs/poll/<token>/ every 10 minutes (services.poll_jobs), which
  finishes jobs whose webhook never arrived and fails jobs stuck for over 30 minutes;
- the job page (GET /api/jobs/{id}/) also refreshes a running job, at most every 10 seconds.

django-q2 stays installed and configured in case a paid plan adds a worker later.
"""
