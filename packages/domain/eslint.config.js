import base from '@gym/config/eslint/base';
import { boundariesConfig } from '@gym/config/eslint/boundaries';

export default [...base, ...boundariesConfig()];
