import React, { useState, useEffect, useId, useRef, forwardRef } from 'react';

import classNames from 'classnames';
import ReactDOM from 'react-dom';

import { Close } from '../Close';
import { SIZES } from '../Utils/constant';
import { useMediaQuery } from '../../utilities/hooks/useMediaQuery';
import type { ModalProps, ModalHeaderProps, ModalBodyProps } from './types/Modal.types';

import moduleStyles from '../../styles/modal/index.module.css';

const Modal = forwardRef<HTMLDivElement, ModalProps>((props, ref) => {
  const { children, isVisible = false, closeModal = () => {}, size = SIZES.MEDIUM } = props;

  const [showModal, setShowModal] = useState(isVisible);
  // the Esc handler calls the newest closeModal without re-binding on every render
  const closeModalRef = useRef(closeModal);
  closeModalRef.current = closeModal;

  // phones get a slide-up animation instead of the fade
  const isMobile = useMediaQuery('(max-width: 767px)');

  const onAnimationEnd = () => {
    if (!isVisible)
      ReactDOM.flushSync(() => {
        setShowModal(false);
      });
  };

  // stable across renders: the dialog's aria-labelledby/-describedby point at these ids
  const uniqueId = useId();

  useEffect(() => {
    const handleEscKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        if (isVisible) closeModalRef.current(event);
      }
    };

    if (isVisible) {
      setShowModal(true);
      document.body.classList.add(moduleStyles['hl-modal-active']);
    } else {
      document.body.classList.remove(moduleStyles['hl-modal-active']);
    }

    document.addEventListener('keydown', handleEscKey, false);
    return () => {
      document.removeEventListener('keydown', handleEscKey, false);
    };
  }, [isVisible]);

  const modalDialogWrapperClasses = classNames({
    [moduleStyles['hl-modal']]: true,
    [moduleStyles['hl-modal--medium']]: !!size && size === SIZES.MEDIUM,
    [moduleStyles['hl-modal--small']]: !!size && size === SIZES.SMALL,
  });

  const backdropClasses = classNames({
    [moduleStyles['hl-modal-backdrop']]: true,
  });

  return (
    showModal &&
    ReactDOM.createPortal(
      <>
        <div
          className={modalDialogWrapperClasses}
          aria-modal="true"
          role="dialog"
          ref={ref}
          aria-describedby={`body-${uniqueId}`}
          aria-labelledby={`title-${uniqueId}`}
          onAnimationEnd={onAnimationEnd}
          style={{
            animation: `${
              isVisible
                ? isMobile
                  ? 'var(--hl-transition_slide-modal-to-top, slide-modal-to-top 350ms ease-in)'
                  : 'var(--hl-transition_fade-in-modal, 200ms fade-in-modal ease)'
                : isMobile
                  ? 'var(--hl-transition_slide-modal-to-bottom, 350ms slide-modal-to-bottom ease-in-out)'
                  : 'var(--hl-transition_fade-out-modal, 200ms fade-out-modal ease)'
            }`,
          }}
        >
          <div className={moduleStyles['hl-modal-content']}>
            {React.Children.map(children, (child, index) => {
              if (!React.isValidElement(child)) return child;
              return React.cloneElement(child as React.ReactElement<Record<string, unknown>>, {
                key: index,
                uniqueId,
                closeModal,
              });
            })}
          </div>
        </div>
        <div
          className={backdropClasses}
          onAnimationEnd={onAnimationEnd}
          style={{
            animation: `${
              isVisible
                ? 'var(--hl-transition_backdrop-open-modal, 200ms backdrop-open ease)'
                : 'var(--hl-transition_backdrop-close-modal, 200ms backdrop-close ease)'
            }`,
          }}
        />
      </>,
      document.body,
    )
  );
});

Modal.displayName = 'Modal';

const ModalHeader = (props: ModalHeaderProps) => {
  const { closeModal = () => {}, title = '', uniqueId: id } = props;

  return (
    <header className={moduleStyles['hl-modal__header']} id={`title-${id}`}>
      <h2 className={moduleStyles['hl-modal__title']}>{title}</h2>
      <Close
        className={moduleStyles['hl-modal__close']}
        onClick={(event: React.MouseEvent) => closeModal(event)}
        ariaLabel="Close dialog"
      />
    </header>
  );
};

/** The dialog's content (dialogs here put their own buttons in the body; there is no footer). */
const ModalBody = (props: ModalBodyProps) => {
  const { children, uniqueId: id } = props;

  return (
    <div className={moduleStyles['hl-modal__body']} id={`body-${id}`}>
      {children}
    </div>
  );
};

ModalHeader.displayName = 'ModalHeader';
ModalBody.displayName = 'ModalBody';

export type ModalType = typeof Modal & {
  Header: typeof ModalHeader;
  Body: typeof ModalBody;
};

export default Object.assign(Modal, {
  Header: ModalHeader,
  Body: ModalBody,
}) as ModalType;
