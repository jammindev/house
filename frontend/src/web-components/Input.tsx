import React from 'react';
import { Input } from '@/components/ui/input';
import type { InputProps } from '@/components/ui/input';
import { createWebComponent } from './createWebComponent';
import './styles.css';

type InputWrapperProps = Omit<InputProps, 'children'>;

const InputWrapper: React.FC<InputWrapperProps> = (props) => (
  <Input {...props} />
);

export const { WebComponent: InputElement, ReactComponent: InputComponent } =
  createWebComponent<InputWrapperProps>({
    component: InputWrapper,
    tagName: 'ui-input',
    propMapping: {
      type: 'string',
      value: 'string',
      placeholder: 'string',
      name: 'string',
      id: 'string',
      autocomplete: 'string',
      disabled: 'boolean',
      readonly: 'boolean',
      required: 'boolean',
      minlength: 'number',
      maxlength: 'number',
    },
    defaultProps: {
      type: 'text',
    },
    events: {
      onInput: 'ui-input',
      onChange: 'ui-change',
      onFocus: 'ui-focus',
      onBlur: 'ui-blur',
    },
  });

export default InputElement;
