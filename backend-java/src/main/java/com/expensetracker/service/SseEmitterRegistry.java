package com.expensetracker.service;

import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

@Component
@Slf4j
public class SseEmitterRegistry {

    private final Map<Long, SseEmitter> emitters = new ConcurrentHashMap<>();

    public SseEmitter getOrCreate(Long statementId) {
        return emitters.computeIfAbsent(statementId, id -> {
            SseEmitter emitter = new SseEmitter(5 * 60 * 1000L); // 5 min timeout
            emitter.onCompletion(() -> emitters.remove(id));
            emitter.onTimeout(() -> emitters.remove(id));
            emitter.onError(e -> emitters.remove(id));
            return emitter;
        });
    }

    public void send(Long statementId, String event, Object data) {
        SseEmitter emitter = emitters.get(statementId);
        if (emitter == null) return;
        try {
            emitter.send(SseEmitter.event().name(event).data(data));
        } catch (Exception e) {
            log.warn("SSE send failed for statement {}: {}", statementId, e.getMessage());
            emitters.remove(statementId);
        }
    }

    public void complete(Long statementId) {
        SseEmitter emitter = emitters.remove(statementId);
        if (emitter != null) {
            try { emitter.complete(); } catch (Exception ignored) {}
        }
    }

    public void completeWithError(Long statementId, Throwable ex) {
        SseEmitter emitter = emitters.remove(statementId);
        if (emitter != null) {
            try { emitter.completeWithError(ex); } catch (Exception ignored) {}
        }
    }
}
