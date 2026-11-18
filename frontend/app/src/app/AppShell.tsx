import { Outlet } from 'react-router-dom';
import { OptionSelect, SnackbarContainer, TopBar } from '@crm/ui';
import { DEMO_USERS, setActingAs, useActingAs } from './actingAs';
import { setTheme, useTheme, type ThemeChoice } from './theme';

const ACTING_AS_OPTIONS = DEMO_USERS.map((u) => ({ label: u, value: u }));
const THEME_OPTIONS: { label: string; value: ThemeChoice }[] = [
  { label: 'Light', value: 'light' },
  { label: 'Dark', value: 'dark' },
  { label: 'System', value: 'system' },
];

/** What every page sits in: the slim top bar and a centred content area. No sidebar, no navigation. */
export function AppShell() {
  const actingAs = useActingAs();
  const theme = useTheme();
  return (
    <SnackbarContainer>
      <TopBar title="CRM">
        <OptionSelect
          ariaLabel="Colour theme"
          prefix="Theme:"
          options={THEME_OPTIONS}
          value={theme}
          onChange={setTheme}
          placement="bottom-end"
        />
        {/* "Acting as": a demo label for who makes the changes (no login), so two tabs can play two users */}
        <OptionSelect
          ariaLabel="Acting as"
          prefix="Acting as:"
          options={ACTING_AS_OPTIONS}
          value={actingAs}
          onChange={setActingAs}
          placement="bottom-end"
        />
      </TopBar>
      <div
        style={{
          maxWidth: 1600,
          margin: '0 auto',
          padding: 'var(--hl-space-4) var(--hl-space-5, 20px)',
        }}
      >
        <Outlet />
      </div>
    </SnackbarContainer>
  );
}
