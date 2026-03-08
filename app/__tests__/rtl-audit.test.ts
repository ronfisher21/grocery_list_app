import * as fs from 'fs';
import * as path from 'path';

/**
 * RTL Audit — verifies Hebrew/RTL integrity across the app.
 *
 * 1. I18nManager.forceRTL(true) must be called in the app entry point.
 * 2. No hardcoded English strings in visible UI JSX (Text components, placeholders, titles).
 */

const APP_ROOT = path.resolve(__dirname, '..');

function findFiles(dir: string, ext: string): string[] {
  const results: string[] = [];
  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.name === 'node_modules' || entry.name === '@core' || entry.name === '__tests__') continue;
      if (entry.isDirectory()) {
        results.push(...findFiles(fullPath, ext));
      } else if (entry.name.endsWith(ext)) {
        results.push(fullPath);
      }
    }
  } catch {
    // directory may not exist yet
  }
  return results;
}

describe('RTL Audit', () => {
  it('I18nManager.forceRTL(true) is called in the app entry point', () => {
    // Check common entry points
    const entryPoints = [
      path.join(APP_ROOT, 'App.tsx'),
      path.join(APP_ROOT, 'App.ts'),
      path.join(APP_ROOT, 'app', '_layout.tsx'), // Expo Router
      path.join(APP_ROOT, 'index.ts'),
      path.join(APP_ROOT, 'index.tsx'),
    ];

    let found = false;
    for (const entry of entryPoints) {
      if (fs.existsSync(entry)) {
        const content = fs.readFileSync(entry, 'utf-8');
        if (content.includes('I18nManager.forceRTL(true)') || content.includes('I18nManager.allowRTL(true)')) {
          found = true;
          break;
        }
      }
    }

    expect(found).toBe(true);
  });

  it('no hardcoded English strings in TSX Text components', () => {
    const tsxFiles = findFiles(APP_ROOT, '.tsx');
    const violations: { file: string; line: number; text: string }[] = [];

    // Regex to find <Text...>English text</Text> or placeholder="English"
    const englishInJsx = />[A-Za-z]{3,}[^<]*</g;
    const englishPlaceholder = /placeholder=["'][A-Za-z]/g;
    const englishTitle = /title=["'][A-Za-z]/g;

    // Allowlist: component names, style props, imports, etc.
    const allowlist = [
      /^>Text</, /^>View</, /^>Pressable</, /^>TouchableOpacity</,
      /^>SafeAreaView</, /^>FlatList</, /^>SectionList</,
      /console\./, /import /, /export /, /\/\//, /\{\/\*/,
    ];

    for (const file of tsxFiles) {
      const content = fs.readFileSync(file, 'utf-8');
      const lines = content.split('\n');

      lines.forEach((line, idx) => {
        // Skip imports, comments, style definitions
        const trimmed = line.trim();
        if (trimmed.startsWith('import ') || trimmed.startsWith('//') || trimmed.startsWith('*') || trimmed.startsWith('/*')) return;
        if (trimmed.includes('console.') || trimmed.includes('style')) return;

        // Check for English text in JSX content
        const matches = trimmed.match(englishInJsx);
        if (matches) {
          for (const match of matches) {
            const isAllowed = allowlist.some(re => re.test(match));
            if (!isAllowed) {
              violations.push({
                file: path.relative(APP_ROOT, file),
                line: idx + 1,
                text: match.slice(0, 50),
              });
            }
          }
        }

        // Check for English in placeholder/title attributes
        if (englishPlaceholder.test(trimmed) || englishTitle.test(trimmed)) {
          violations.push({
            file: path.relative(APP_ROOT, file),
            line: idx + 1,
            text: trimmed.slice(0, 60),
          });
        }
      });
    }

    if (violations.length > 0) {
      const report = violations.map(v => `  ${v.file}:${v.line} — ${v.text}`).join('\n');
      throw new Error(`Found hardcoded English strings in UI:\n${report}`);
    }
  });
});
