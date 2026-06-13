package com.expensetracker.util;

import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Optional;

/**
 * Local keyword rules for common GCC merchants.
 * Checked before any AI call — zero tokens consumed on a match.
 *
 * Keys are lowercase substrings; more specific entries must come before broader ones.
 */
public final class GccMerchantRules {

    private GccMerchantRules() {}

    // Order matters: specific first, generic last within each category block.
    private static final LinkedHashMap<String, String> RULES = new LinkedHashMap<>();

    static {
        // ── Groceries & Supermarkets ────────────────────────────────────────
        put("carrefour",          "Groceries");
        put("lulu hypermarket",   "Groceries");
        put("lulu hyper",         "Groceries");
        put("spinneys",           "Groceries");
        put("waitrose",           "Groceries");
        put("choithrams",         "Groceries");
        put("al raya",            "Groceries");
        put("panda",              "Groceries");
        put("al meera",           "Groceries");
        put("sultan center",      "Groceries");
        put("geant",              "Groceries");
        put("monoprix",           "Groceries");
        put("west zone",          "Groceries");
        put("al madina",          "Groceries");
        put("union coop",         "Groceries");
        put("abu dhabi coop",     "Groceries");
        put("emirates coop",      "Groceries");
        put("al ain coop",        "Groceries");
        put("nesto",              "Groceries");
        put("viva superstore",    "Groceries");
        put("tamimi",             "Groceries");
        put("othaim",             "Groceries");
        put("al safeer",          "Groceries");
        put("spar",               "Groceries");
        put("safari hypermarket", "Groceries");
        put("megamart",           "Groceries");
        put("day to day",         "Groceries");
        put("noon daily",         "Groceries");
        put("kibsons",            "Groceries");
        put("souq extra",         "Groceries");
        put("hypermarket",        "Groceries");
        put("supermarket",        "Groceries");
        put("supermercado",       "Groceries");
        put("minimarket",         "Groceries");
        put("minimart",           "Groceries");
        put("mini mart",          "Groceries");
        put("mini market",        "Groceries");
        put("superstore",         "Groceries");
        put("grocery",            "Groceries");
        put("co-op",              "Groceries");
        put("coop ",              "Groceries"); // trailing space avoids matching "cooperation"

        // ── Fuel ────────────────────────────────────────────────────────────
        put("adnoc",              "Fuel");
        put("enoc",               "Fuel");
        put("eppco",              "Fuel");
        put("total energies",     "Fuel");
        put("totalenergies",      "Fuel");
        put("shell",              "Fuel");
        put("caltex",             "Fuel");
        put("q8 petroleum",       "Fuel");
        put("kuwait petroleum",   "Fuel");
        put("bapco",              "Fuel");
        put("oman oil",           "Fuel");
        put("woqod",              "Fuel");
        put("noc station",        "Fuel");
        put("petrol station",     "Fuel");
        put("fuel station",       "Fuel");
        put("filling station",    "Fuel");
        put("service station",    "Fuel");
        put("gas station",        "Fuel");

        // ── Restaurants & Cafes ─────────────────────────────────────────────
        put("mcdonald",           "Dining");
        put("kfc",                "Dining");
        put("burger king",        "Dining");
        put("pizza hut",          "Dining");
        put("domino",             "Dining");
        put("subway",             "Dining");
        put("hardee",             "Dining");
        put("tim horton",         "Dining");
        put("starbucks",          "Dining");
        put("costa coffee",       "Dining");
        put("dunkin",             "Dining");
        put("krispy kreme",       "Dining");
        put("shake shack",        "Dining");
        put("five guys",          "Dining");
        put("the cheesecake factory", "Dining");
        put("applebee",           "Dining");
        put("tgi friday",         "Dining");
        put("chili's",            "Dining");
        put("ihop",               "Dining");
        put("fuddruckers",        "Dining");
        put("johnny rockets",     "Dining");
        put("al baik",            "Dining");
        put("albaik",             "Dining");
        put("kudu",               "Dining");
        put("herfy",              "Dining");
        put("maestro pizza",      "Dining");
        put("papa john",          "Dining");
        put("popeyes",            "Dining");
        put("raising cane",       "Dining");
        put("texas roadhouse",    "Dining");
        put("restaurant",         "Dining");
        put("cafe",               "Dining");
        put("coffee shop",        "Dining");
        put("bakery",             "Dining");
        put("grill",              "Dining");
        put("bistro",             "Dining");
        put("diner",              "Dining");
        put("eatery",             "Dining");
        put("kitchen",            "Dining");

        // ── Food Delivery ───────────────────────────────────────────────────
        put("talabat",            "Food Delivery");
        put("deliveroo",          "Food Delivery");
        put("noon food",          "Food Delivery");
        put("carriage",           "Food Delivery");
        put("hunger station",     "Food Delivery");
        put("jahez",              "Food Delivery");
        put("marsool",            "Food Delivery");
        put("toters",             "Food Delivery");

        // ── Pharmacy & Health ───────────────────────────────────────────────
        put("aster pharmacy",     "Pharmacy");
        put("boots pharmacy",     "Pharmacy");
        put("life pharmacy",      "Pharmacy");
        put("bin sina",           "Pharmacy");
        put("binsina",            "Pharmacy");
        put("al dawaa",           "Pharmacy");
        put("nahdi",              "Pharmacy");
        put("united pharmacy",    "Pharmacy");
        put("oman pharmacy",      "Pharmacy");
        put("golden pharmacy",    "Pharmacy");
        put("pharmacy",           "Pharmacy");
        put("chemist",            "Pharmacy");
        put("drugstore",          "Pharmacy");

        // ── Healthcare ──────────────────────────────────────────────────────
        put("aster hospital",     "Healthcare");
        put("aster clinic",       "Healthcare");
        put("mediclinic",         "Healthcare");
        put("nmc hospital",       "Healthcare");
        put("cleveland clinic",   "Healthcare");
        put("american hospital",  "Healthcare");
        put("saudi german",       "Healthcare");
        put("burjeel",            "Healthcare");
        put("thumbay",            "Healthcare");
        put("llh hospital",       "Healthcare");
        put("hospital",           "Healthcare");
        put("clinic",             "Healthcare");
        put("medical center",     "Healthcare");
        put("health center",      "Healthcare");
        put("dental",             "Healthcare");
        put("polyclinic",         "Healthcare");

        // ── Telecom ─────────────────────────────────────────────────────────
        put("etisalat",           "Telecom");
        put("e& ",                "Telecom");  // e& brand (trailing space avoids false matches)
        put("du telecom",         "Telecom");
        put("stc",                "Telecom");
        put("zain",               "Telecom");
        put("ooredoo",            "Telecom");
        put("batelco",            "Telecom");
        put("beyon",              "Telecom");

        // ── Transport & Ride-hailing ─────────────────────────────────────────
        put("uber",               "Transport");
        put("careem",             "Transport");
        put("rta ",               "Transport");
        put("hafilat",            "Transport");
        put("sasco",              "Transport");
        put("metro",              "Transport");
        put("taxi",               "Transport");

        // ── Electronics & Tech ──────────────────────────────────────────────
        put("sharaf dg",          "Electronics");
        put("emax",               "Electronics");
        put("istyle",             "Electronics");
        put("apple store",        "Electronics");
        put("samsung store",      "Electronics");
        put("virgin megastore",   "Electronics");
        put("jacky's",            "Electronics");
        put("jackys",             "Electronics");

        // ── Retail & Fashion ────────────────────────────────────────────────
        put("h&m",                "Shopping");
        put("zara",               "Shopping");
        put("marks & spencer",    "Shopping");
        put("marks and spencer",  "Shopping");
        put("next ",              "Shopping");
        put("mango",              "Shopping");
        put("gap",                "Shopping");
        put("forever 21",         "Shopping");
        put("massimo dutti",      "Shopping");
        put("pull & bear",        "Shopping");
        put("bershka",            "Shopping");
        put("primark",            "Shopping");
        put("splash",             "Shopping");
        put("centrepoint",        "Shopping");
        put("max fashion",        "Shopping");
        put("brands for less",    "Shopping");
        put("matalan",            "Shopping");
        put("shoe mart",          "Shopping");
        put("namshi",             "Shopping");
        put("6th street",         "Shopping");
        put("noon.com",           "Shopping");
        put("amazon.ae",          "Shopping");

        // ── Home & Furniture ────────────────────────────────────────────────
        put("ikea",               "Home");
        put("home centre",        "Home");
        put("pan emirates",       "Home");
        put("ace hardware",       "Home");
        put("danube home",        "Home");

        // ── Entertainment ───────────────────────────────────────────────────
        put("vox cinemas",        "Entertainment");
        put("reel cinemas",       "Entertainment");
        put("novo cinemas",       "Entertainment");
        put("cinepolis",          "Entertainment");
        put("cinestar",           "Entertainment");
        put("dubai parks",        "Entertainment");
        put("legoland",           "Entertainment");
        put("motiongate",         "Entertainment");
        put("ferrari world",      "Entertainment");
        put("yas waterworld",     "Entertainment");
        put("seaworld",           "Entertainment");
        put("global village",     "Entertainment");
        put("img worlds",         "Entertainment");
        put("cinema",             "Entertainment");
        put("theme park",         "Entertainment");
        put("waterpark",          "Entertainment");

        // ── Education ───────────────────────────────────────────────────────
        put("school fees",        "Education");
        put("university fees",    "Education");
        put("tuition",            "Education");
        put("nursery",            "Education");

        // ── Transfers ───────────────────────────────────────────────────────
        // "from " is intentionally omitted here and handled via startsWith in match()
        // to avoid false positives for mid-string occurrences like "Refund from Amazon".

        // ── Income ──────────────────────────────────────────────────────────
        put("salary",             "Income");
        put("payroll",            "Income");
        put("cashback reward",    "Cashback");  // specific before generic
        put("cash back reward",   "Cashback");
        put("cash back",          "Income");
        put("cashback",           "Income");
        put("refund",             "Income");
        put("reimbursement",      "Income");
        put("dividend",           "Income");
        put("rental income",      "Income");
        put("freelance",          "Income");
        put("bonus",              "Income");
        put("commission",         "Income");
        put("interest earned",    "Income");
        put("profit share",       "Income");
    }

    private static void put(String keyword, String category) {
        RULES.put(keyword.toLowerCase(), category);
    }

    /**
     * Returns the category name for a matched GCC merchant keyword, or empty if no rule matches.
     * Zero AI tokens consumed on a hit.
     */
    public static Optional<String> match(String merchantName) {
        if (merchantName == null || merchantName.isBlank()) return Optional.empty();
        String lower = merchantName.toLowerCase();
        // Check keyword rules first so specific entries (salary, payroll, refund …)
        // win over the generic "from " Transfer fallback below.
        for (Map.Entry<String, String> entry : RULES.entrySet()) {
            if (lower.contains(entry.getKey())) {
                return Optional.of(entry.getValue());
            }
        }
        // "from " as Transfer only when no keyword matched — catches person-to-person
        // transfers like "From Faress Salloum" but not "From Salary Transfer" (salary wins above).
        if (lower.startsWith("from ")) return Optional.of("Transfer");
        return Optional.empty();
    }
}
