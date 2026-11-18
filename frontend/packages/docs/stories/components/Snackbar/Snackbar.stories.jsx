import { Button, SnackbarContainer, useSnackbar } from '@crm/ui';

export default { title: 'Components/Molecule/Snackbar', tags: ['autodocs'] };

const Buttons = () => {
  const show = useSnackbar();
  return (
    <div style={{ display: 'flex', gap: 8 }}>
      <Button
        label="Success"
        variant="secondary"
        onClick={() => show({ type: 'success', message: 'Contact saved' })}
      />
      <Button
        label="Error"
        variant="secondary"
        onClick={() =>
          show({
            type: 'error',
            message: "Couldn't add tag VIP: something went wrong.",
            duration: 6000,
          })
        }
      />
    </div>
  );
};

export const Toasts = {
  render: () => (
    <SnackbarContainer>
      <Buttons />
    </SnackbarContainer>
  ),
};
