package com.expensetracker.model;

public enum Plan {
    FREE("free", "Free", 15, false),
    SOLO("solo", "Solo", 75, false),
    PRO("pro", "Pro", 300, false),
    BUSINESS("business", "Business", 1500, true);

    public final String key;
    public final String label;
    public final int pageLimit;
    public final boolean overageEnabled;

    Plan(String key, String label, int pageLimit, boolean overageEnabled) {
        this.key = key;
        this.label = label;
        this.pageLimit = pageLimit;
        this.overageEnabled = overageEnabled;
    }

    public static Plan fromKey(String key) {
        for (Plan p : values()) {
            if (p.key.equals(key)) return p;
        }
        return FREE;
    }
}
