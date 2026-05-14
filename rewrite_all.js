const fs = require('fs');
const path = require('path');

function walkDir(dir, callback) {
  fs.readdirSync(dir).forEach(f => {
    let dirPath = path.join(dir, f);
    let isDirectory = fs.statSync(dirPath).isDirectory();
    if (isDirectory) {
      if(f !== 'node_modules' && f !== '.next' && f !== 'dist') walkDir(dirPath, callback);
    } else {
      callback(path.join(dir, f));
    }
  });
}

const files = [];
walkDir('.', (filePath) => {
  if (filePath.endsWith('.tsx')) {
    files.push(filePath);
  }
});

for (const file of files) {
  let content = fs.readFileSync(file, 'utf8');

  let changed = false;

  // Sometimes there's a React.forwardRef or something, but we'll try to handle basic formats.
  if (content.includes('import { theme } from') || content.includes('import {theme} from')) {
    content = content.replace(/import\s+\{\s*theme\s*\}\s+from\s+['"]([^'"]+)['"]/g, "import { useAppTheme } from '$1'");
    changed = true;
  }
  
  if (changed) {
    if (content.match(/const styles = StyleSheet\.create\(\{/)) {
        content = content.replace(/const styles = StyleSheet\.create\(\{/, 'const createStyles = (theme: any) => StyleSheet.create({');
    }

    if (!content.includes('const theme = useAppTheme();')) {
      content = content.replace(/(export default function \w+\([^)]*\)\s*\{)/g, '$1\n  const theme = useAppTheme();\n  const styles = createStyles(theme);\n');
      content = content.replace(/(export function \w+\([^)]*\)\s*\{)/g, '$1\n  const theme = useAppTheme();\n  const styles = createStyles(theme);\n');
      content = content.replace(/(export const \w+\s*=\s*(?:React\.forwardRef\()?.*?=>\s*\{(?!\s*return))/g, '$1\n  const theme = useAppTheme();\n  const styles = createStyles(theme);\n');
    }
    fs.writeFileSync(file, content);
  }
}
