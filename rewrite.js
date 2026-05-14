const fs = require('fs');
const files = [
"./app/onboarding.tsx",
"./app/privacidade-seguranca.tsx",
"./app/(tabs)/alertas.tsx",
"./app/(tabs)/busca.tsx",
"./app/(tabs)/salvos.tsx",
"./app/(tabs)/inicio.tsx",
"./app/(tabs)/perfil.tsx",
"./app/login.tsx",
"./app/notificacoes.tsx",
"./app/concurso/[id].tsx",
"./app/cadastro.tsx",
"./app/preferencias-iniciais.tsx",
"./src/components/SearchInput.tsx",
"./src/components/StatusBadge.tsx",
"./src/components/EmptyState.tsx",
"./src/components/ErrorState.tsx",
"./src/components/LoadingState.tsx",
"./src/components/ConcursoCard.tsx"
];

for (const file of files) {
  if (!fs.existsSync(file)) continue;
  let content = fs.readFileSync(file, 'utf8');

  content = content.replace(/import\s+\{\s*theme\s*\}\s+from\s+['"]([^'"]+)['"]/g, "import { useAppTheme } from '$1'");

  if (content.match(/const styles = StyleSheet\.create\(\{/)) {
      content = content.replace(/const styles = StyleSheet\.create\(\{/, 'const createStyles = (theme: any) => StyleSheet.create({');
  }

  // We need to inject `const theme = useAppTheme();` and `const styles = createStyles(theme);`
  // We look for export default function Name() {
  content = content.replace(/(export default function \w+\([^)]*\)\s*\{)/g, '$1\n  const theme = useAppTheme();\n  const styles = createStyles(theme);\n');
  content = content.replace(/(export function \w+\([^)]*\)\s*\{)/g, '$1\n  const theme = useAppTheme();\n  const styles = createStyles(theme);\n');

  fs.writeFileSync(file, content);
}
