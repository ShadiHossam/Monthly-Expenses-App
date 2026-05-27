package com.expensetracker.service;

import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.CopyOnWriteArrayList;

/**
 * Buffers SSE events so progress fired before the client connects is not lost.
 * The buffer is kept until the client connects and drains it, at which point the
 * emitter is immediately completed/errored if processing already finished.
 */
@Component
@Slf4j
public class SseEmitterRegistry {

    private record PendingEvent(String event, Object data) {}

    private enum TerminalState { NONE, COMPLETED, ERRORED }

    private static class StatementBuffer {
        final List<PendingEvent> events = new CopyOnWriteArrayList<>();
        volatile TerminalState terminal = TerminalState.NONE;
        volatile Throwable error;
    }

    private final Map<Long, SseEmitter> emitters = new ConcurrentHashMap<>();
    private final Map<Long, StatementBuffer> buffers = new ConcurrentHashMap<>();

    private StatementBuffer bufferFor(Long id) {
        return buffers.computeIfAbsent(id, k -> new StatementBuffer());
    }

    public SseEmitter getOrCreate(Long statementId) {
        return emitters.computeIfAbsent(statementId, id -> {
            SseEmitter emitter = new SseEmitter(5 * 60 * 1000L);
            emitter.onCompletion(() -> { emitters.remove(id); buffers.remove(id); });
            emitter.onTimeout(() -> { emitters.remove(id); buffers.remove(id); });
            emitter.onError(e -> { emitters.remove(id); buffers.remove(id); });

            // Drain buffered events that fired before this connection opened
            StatementBuffer buf = buffers.get(id);
            if (buf != null) {
                for (PendingEvent e : buf.events) {
                    try { emitter.send(SseEmitter.event().name(e.event()).data(e.data())); } catch (Exception ignored) {}
                }
                // If processing already finished before the client connected, resolve immediately
                if (buf.terminal == TerminalState.COMPLETED) {
                    buffers.remove(id);
                    try { emitter.complete(); } catch (Exception ignored) {}
                } else if (buf.terminal == TerminalState.ERRORED) {
                    buffers.remove(id);
                    try { emitter.completeWithError(buf.error != null ? buf.error : new RuntimeException("Processing failed")); } catch (Exception ignored) {}
                }
            }
            return emitter;
        });
    }

    public void send(Long statementId, String event, Object data) {
        SseEmitter emitter = emitters.get(statementId);
        if (emitter == null) {
            bufferFor(statementId).events.add(new PendingEvent(event, data));
            return;
        }
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
            buffers.remove(statementId);
            try { emitter.complete(); } catch (Exception ignored) {}
        } else {
            // Client hasn't connected yet — mark terminal so getOrCreate completes it on arrival
            bufferFor(statementId).terminal = TerminalState.COMPLETED;
        }
    }

    public void completeWithError(Long statementId, Throwable ex) {
        SseEmitter emitter = emitters.remove(statementId);
        if (emitter != null) {
            buffers.remove(statementId);
            try { emitter.completeWithError(ex); } catch (Exception ignored) {}
        } else {
            StatementBuffer buf = bufferFor(statementId);
            buf.error = ex;
            buf.terminal = TerminalState.ERRORED;
        }
    }
}
