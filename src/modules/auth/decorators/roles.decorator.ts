// import { SetMetadata } from '@nestjs/common';
// // import { UserRole } from '../../../common/types/user.types';
// import { UserRole } from '@prisma/client';

// export const ROLES_KEY = 'roles';
// export const Roles = (...roles: UserRole[]) => SetMetadata(ROLES_KEY, roles);

import { SetMetadata } from '@nestjs/common';

export const Roles = (...roles: string[]) => SetMetadata('roles', roles);