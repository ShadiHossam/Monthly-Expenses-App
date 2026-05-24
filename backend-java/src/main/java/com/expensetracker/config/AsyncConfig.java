package com.expensetracker.config;

import jakarta.annotation.PreDestroy;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.scheduling.annotation.AsyncConfigurer;
import org.springframework.scheduling.annotation.EnableAsync;
import org.springframework.scheduling.concurrent.ThreadPoolTaskExecutor;

import java.util.concurrent.Executor;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;

@Configuration
@EnableAsync
public class AsyncConfig implements AsyncConfigurer {

    private ExecutorService qaExecutorInstance;

    @Override
    @Bean(name = "taskExecutor")
    public Executor getAsyncExecutor() {
        ThreadPoolTaskExecutor executor = new ThreadPoolTaskExecutor();
        executor.setCorePoolSize(4);
        executor.setMaxPoolSize(20);
        executor.setQueueCapacity(50);
        executor.setThreadNamePrefix("async-ocr-");
        executor.initialize();
        return executor;
    }

    @Bean("qaExecutor")
    public ExecutorService qaExecutor() {
        qaExecutorInstance = Executors.newFixedThreadPool(5);
        return qaExecutorInstance;
    }

    @PreDestroy
    public void shutdownQaExecutor() throws InterruptedException {
        if (qaExecutorInstance != null) {
            qaExecutorInstance.shutdown();
            if (!qaExecutorInstance.awaitTermination(10, TimeUnit.SECONDS)) {
                qaExecutorInstance.shutdownNow();
            }
        }
    }
}
