package com.expensetracker.config;

import io.netty.channel.ChannelOption;
import io.netty.handler.ssl.SslContext;
import io.netty.handler.ssl.SslContextBuilder;
import io.netty.handler.timeout.ReadTimeoutHandler;
import io.netty.handler.timeout.WriteTimeoutHandler;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.client.reactive.ReactorClientHttpConnector;
import org.springframework.web.reactive.function.client.WebClient;
import reactor.netty.http.client.HttpClient;

import javax.net.ssl.SSLException;
import java.time.Duration;
import java.util.concurrent.TimeUnit;

@Configuration
public class WebClientConfig {

    private final AppProperties appProperties;

    public WebClientConfig(AppProperties appProperties) {
        this.appProperties = appProperties;
    }

    // External AI APIs can be slow under concurrent load — keep timeouts generous so a
    // brief network hiccup doesn't fail every retry on a parallel upload burst.
    private static final int CONNECT_TIMEOUT_MS = 30_000;
    private static final int READ_TIMEOUT_S     = 120;
    private static final int WRITE_TIMEOUT_S    = 60;
    // Netty's default SSL handshake timeout is 10s — far too short when Docker
    // networking is disrupted (e.g. after Mac sleep/wake). Raise to match connect timeout.
    // spec.sslContext(SslContext) returns SslProvider.Builder which has handshakeTimeout();
    // spec.sslContext(SslContextBuilder) returns DefaultConfigurationSpec which does not.
    private static final Duration SSL_HANDSHAKE_TIMEOUT = Duration.ofSeconds(30);

    private static final SslContext SSL_CONTEXT;
    static {
        try {
            SSL_CONTEXT = SslContextBuilder.forClient().build();
        } catch (SSLException e) {
            throw new ExceptionInInitializerError(e);
        }
    }

    private ReactorClientHttpConnector httpConnector() {
        HttpClient client = HttpClient.create()
                .option(ChannelOption.CONNECT_TIMEOUT_MILLIS, CONNECT_TIMEOUT_MS)
                .responseTimeout(Duration.ofSeconds(READ_TIMEOUT_S))
                .secure(spec -> spec.sslContext(SSL_CONTEXT).handshakeTimeout(SSL_HANDSHAKE_TIMEOUT))
                .doOnConnected(conn -> conn
                        .addHandlerLast(new ReadTimeoutHandler(READ_TIMEOUT_S, TimeUnit.SECONDS))
                        .addHandlerLast(new WriteTimeoutHandler(WRITE_TIMEOUT_S, TimeUnit.SECONDS)));
        return new ReactorClientHttpConnector(client);
    }

    @Bean("groqClient")
    public WebClient groqClient() {
        return WebClient.builder()
                .baseUrl("https://api.groq.com")
                .clientConnector(httpConnector())
                .codecs(c -> c.defaultCodecs().maxInMemorySize(10 * 1024 * 1024))
                .build();
    }

    @Bean("openrouterClient")
    public WebClient openrouterClient() {
        return WebClient.builder()
                .baseUrl("https://openrouter.ai")
                .clientConnector(httpConnector())
                .codecs(c -> c.defaultCodecs().maxInMemorySize(10 * 1024 * 1024))
                .build();
    }

    @Bean("anthropicClient")
    public WebClient anthropicClient() {
        return WebClient.builder()
                .baseUrl("https://api.anthropic.com")
                .clientConnector(httpConnector())
                .codecs(c -> c.defaultCodecs().maxInMemorySize(10 * 1024 * 1024))
                .build();
    }

    @Bean("resendClient")
    public WebClient resendClient() {
        return WebClient.builder()
                .baseUrl("https://api.resend.com")
                .defaultHeader("Authorization", "Bearer " + appProperties.getResend().getApiKey())
                .defaultHeader("Content-Type", "application/json")
                .clientConnector(httpConnector())
                .build();
    }

    @Bean("googleClient")
    public WebClient googleClient(WebClient.Builder builder) {
        return builder
                .clientConnector(httpConnector())
                .build();
    }
}
