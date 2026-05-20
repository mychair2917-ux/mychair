import React from 'react';

import { ButtonRadius } from '../Button/Types';

export interface IconButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  radius?: ButtonRadius;
}
