"""Background tasks (django-q2). Owner: C.

copy_glb(job_id): download the finished GLB and save it to the models bucket.
poll_jobs():      every 10 minutes, re-check submitted jobs; time out after 30 minutes.
"""
