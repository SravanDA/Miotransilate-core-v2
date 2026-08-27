package com.miotranslate.shared.job;

import org.springframework.context.ApplicationEventPublisher;
import org.springframework.stereotype.Service;

@Service
public class JobDispatcher {

    private final ApplicationEventPublisher eventPublisher;

    public JobDispatcher(ApplicationEventPublisher eventPublisher) {
        this.eventPublisher = eventPublisher;
    }

    /**
     * Enqueues an async job. The actual implementation will insert into a DB table (e.g., job_queue)
     * within the current transaction. For now, it delegates to Spring Events.
     */
    public void dispatch(String jobType, Object payload) {
        // TODO: Insert into database table for transactional outbox pattern
        eventPublisher.publishEvent(new AsyncJobEvent(jobType, payload));
    }
    
    public record AsyncJobEvent(String jobType, Object payload) {}
}
