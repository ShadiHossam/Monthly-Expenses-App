package com.expensetracker.service;

import org.springframework.web.multipart.MultipartFile;
import java.io.*;

public class InMemoryMultipartFile implements MultipartFile {

    private final String name;
    private final String originalFilename;
    private final String contentType;
    private final byte[] content;

    public InMemoryMultipartFile(String originalFilename, byte[] content, String contentType) {
        this.name = "file";
        this.originalFilename = originalFilename;
        this.contentType = contentType;
        this.content = content;
    }

    @Override public String getName() { return name; }
    @Override public String getOriginalFilename() { return originalFilename; }
    @Override public String getContentType() { return contentType; }
    @Override public boolean isEmpty() { return content == null || content.length == 0; }
    @Override public long getSize() { return content.length; }
    @Override public byte[] getBytes() { return content; }
    @Override public InputStream getInputStream() { return new ByteArrayInputStream(content); }
    @Override public void transferTo(File dest) throws IOException {
        try (var out = new FileOutputStream(dest)) { out.write(content); }
    }
}
