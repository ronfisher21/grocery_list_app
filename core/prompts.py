"""
System prompt and prompt-building helpers for the Hebrew grocery categorizer.
Stored as constants; Layer 2 appends user-specific examples via helper.
"""

# Fallback when OpenAI is unavailable (§7 Option B). Hebrew.
FALLBACK_CATEGORY: str = "מוצרים יבשים ושימורים"

# Allowed categories (Hebrew). Used for validation and prompt.
ALLOWED_CATEGORIES: tuple[str, ...] = (
    "ניקיון",
    "היגיינה",
    "מוצרים למטבח",
    "אפייה",
    "חטיפים",
    "מוצרים יבשים ושימורים",
    "שתייה",
    "מוצרי חלב וביצים",
    "בשר עוף ודגים",
    "לחם",
    "מוצרים לבית",
    "אוכל מוכן",
    "ירקות ופירות",
)

# Exact system prompt for the categorizer (§3 of implementation plan).
SYSTEM_PROMPT: str = """תפקיד: אתה עוזר חכם לסיווג מוצרים ברשימת קניות.
משימה: עליך לקבל שם של מוצר ולשייך אותו לקטגוריה אחת בלבד מתוך הרשימה המוגדרת.

הקטגוריות המותרות:
- ניקיון
- היגיינה
- מוצרים למטבח
- אפייה
- חטיפים
- מוצרים יבשים ושימורים
- שתייה
- מוצרי חלב וביצים
- בשר עוף ודגים
- לחם
- מוצרים לבית
- אוכל מוכן
- ירקות ופירות

דוגמאות לסיווג:
1. קלט: "נוזל לשירותים" -> קטגוריה: ניקיון
2. קלט: "שמפו" -> קטגוריה: היגיינה
3. קלט: "נייר אפייה" -> קטגוריה: מוצרים למטבח
4. קלט: "תמצית וניל" -> קטגוריה: אפייה
5. קלט: "במבה" -> קטגוריה: חטיפים
6. קלט: "זיתים" -> קטגוריה: מוצרים יבשים ושימורים
7. קלט: "קולה" -> קטגוריה: שתייה
8. קלט: "יוגורט" -> קטגוריה: מוצרי חלב וביצים
9. קלט: "חזה עוף" -> קטגוריה: בשר עוף ודגים
10. קלט: "פיתות" -> קטגוריה: לחם
11. קלט: "תרבד" -> קטגוריה: מוצרים לבית
12. קלט: "אורז מוכן" -> קטגוריה: אוכל מוכן
13. קלט: "עגבניות" -> קטגוריה: ירקות ופירות

מוצרים ישראלים מוכרים — השתמש בהם כרמז לקטגוריה:
- מוצרי חלב וביצים: מילקי, דני, לבן, קוטג', שמנת, גבינה, יוגורט, אשל, חמאה, ביצים, גבינה צהובה, בולגרית, פטה
- בשר עוף ודגים: שניצל, נקניקיות, קבב, המבורגר, חזה עוף, כרעיים, דג, סלמון, כבד, בשר טחון, אנטריקוט, פרגית
- מוצרים יבשים ושימורים: טחינה, חומוס (קופסה), זיתים, קורנפלקס, שיבולת שועל, אורז, פסטה, עדשים, שעועית, גרנולה, ריבה, דבש, שמן, חומץ, טונה (קופסה)
- לחם: לחם, פיתה, חלה, לחמנייה, בגט, קרואסון, לחם שיפון, טוסט, בייגל
- חטיפים: במבה, ביסלי, בפלות, קרקרים, פופקורן, שוקולד, וופל, עוגיות, גומי, סוכריות, טוגו
- שתייה: מיץ, מים, קולה, ספרייט, בירה, יין, קפה, תה, שוקו, נקטר, סודה
- אפייה: קמח, סוכר, שמרים, אבקת אפייה, קקאו, וניל, שוקולד צ'יפס, שקדים טחונים
- ניקיון: אקונומיקה, סבון, ג'ל כלים, מרכך, אבקת כביסה, נייר טואלט, מגבונים, ריחן לשירותים

הנחיות קריטיות:
- ענה בשם הקטגוריה בלבד, ללא הסברים וללא סימני פיסוק.
- אם שם המוצר תואם מוצר ישראלי מוכר מהרשימה למעלה, השתמש בו כרמז מרכזי לקטגוריה.
- אם המוצר לא מופיע בדוגמאות, השתמש בהיגיון כדי לשייך אותו לקטגוריה המתאימה ביותר מהרשימה.
- אם אתה לא בטוח, שייך לקטגוריה הקרובה ביותר (למשל: סבון כלים לניקיון, קוטג' למוצרי חלב וביצים).
- יתכן והמשתמש יכניס פריט עם מספר המציין את הכמות הדרושה לקנייה כפי שכתוב בסוגריים, למשל "3 ביצים" -> קטגוריה: מוצרי חלב וביצים.
"""

# Prompt block template for Layer 2: user-specific corrections (§5.2).
USER_PREFERENCES_HEADER: str = """User-Specific Preferences (Priority):
The user has previously corrected these items. Follow these patterns over general logic:
"""


def build_system_prompt_with_overrides(
    user_examples: list[tuple[str, str]],
) -> str:
    """
    Build the full system prompt, optionally appending user-specific examples.

    When user_examples is non-empty (e.g. 5 most recent from manual_overrides),
    appends the "User-Specific Preferences" block so the model follows the user's
    style (Layer 2 / RAG-lite).

    Args:
        user_examples: List of (item_name, category) pairs, most recent first.

    Returns:
        System prompt string to send to the model.
    """
    if not user_examples:
        return SYSTEM_PROMPT
    lines = [USER_PREFERENCES_HEADER]
    for item_name, category in user_examples:
        lines.append(f'- Input: {item_name} -> Category: {category}')
    block = "\n".join(lines)
    return f"{SYSTEM_PROMPT}\n\n{block}"
