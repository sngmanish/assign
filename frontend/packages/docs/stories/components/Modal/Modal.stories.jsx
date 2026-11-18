import { useState } from 'react';
import { Button, Modal, Text } from '@crm/ui';

export default {
  title: 'Components/Molecule/Modal',
  component: Modal,
  tags: ['autodocs'],
};

export const Default = {
  render: function Render() {
    const [open, setOpen] = useState(false);
    return (
      <>
        <Button label="Open dialog" variant="secondary" onClick={() => setOpen(true)} />
        <Modal isVisible={open} closeModal={() => setOpen(false)} size="sm">
          <Modal.Header title="Add a tag to 3 contacts" />
          <Modal.Body>
            <div>
              <Text tag="p">Choose a tag, or type a new name to create one.</Text>
              <Button label="Done" variant="primary" onClick={() => setOpen(false)} />
            </div>
          </Modal.Body>
        </Modal>
      </>
    );
  },
};
