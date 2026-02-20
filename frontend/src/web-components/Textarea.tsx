import React from 'react';
import { Textarea } from '@/components/ui/textarea';
import { createWebComponent } from './createWebComponent';
import './styles.css';

interface TextareaWrapperProps {
  value?: string;
  placeholder?: string;
  name?: string;
  id?: string;
  disabled?: boolean;
  readonly?: boolean;
  required?: boolean;
  rows?: number;
  minlength?: number;
  maxlength?: number;
  onInput?: React.FormEventHandler<HTMLTextAreaElement>;
  onChange?: React.ChangeEventHandler<HTMLTextAreaElement>;
  onFocus?: React.FocusEventHandler<HTMLTextAreaElement>;
  onBlur?: React.FocusEventHandler<HTMLTextAreaElement>;
}

const TextareaWrapper: React.FC<TextareaWrapperProps> = (props) => (
  <Textarea {...props} />
);

export const {
  WebComponent: TextareaElement,
  ReactComponent: TextareaComponent,
} = createWebComponent<TextareaWrapperProps>({
  component: TextareaWrapper,
  tagName: 'ui-textarea',
  propMapping: {
    value: 'string',
    placeholder: 'string',
    name: 'string',
    id: 'string',
    disabled: 'boolean',
    readonly: 'boolean',
    required: 'boolean',
    rows: 'number',
    minlength: 'number',
    maxlength: 'number',
  },
  events: {
    onInput: 'ui-input',
    onChange: 'ui-change',
    onFocus: 'ui-focus',
    onBlur: 'ui-blur',
  },
});

export default TextareaElement;
