import React from 'react';
import { Select } from '@/components/ui/select';
import type { SelectOption } from '@/components/ui/select';
import { createWebComponent } from './createWebComponent';
import './styles.css';

interface SelectWrapperProps {
  value?: string;
  placeholder?: string;
  name?: string;
  id?: string;
  disabled?: boolean;
  required?: boolean;
  options?: SelectOption[];
  onInput?: React.FormEventHandler<HTMLSelectElement>;
  onChange?: React.ChangeEventHandler<HTMLSelectElement>;
  onFocus?: React.FocusEventHandler<HTMLSelectElement>;
  onBlur?: React.FocusEventHandler<HTMLSelectElement>;
}

const SelectWrapper: React.FC<SelectWrapperProps> = (props) => <Select {...props} />;

export const { WebComponent: SelectElement, ReactComponent: SelectComponent } =
  createWebComponent<SelectWrapperProps>({
    component: SelectWrapper,
    tagName: 'ui-select',
    propMapping: {
      value: 'string',
      placeholder: 'string',
      name: 'string',
      id: 'string',
      disabled: 'boolean',
      required: 'boolean',
      options: 'json',
    },
    events: {
      onInput: 'ui-input',
      onChange: 'ui-change',
      onFocus: 'ui-focus',
      onBlur: 'ui-blur',
    },
  });

export default SelectElement;
