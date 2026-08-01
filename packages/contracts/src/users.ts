export interface UserProfile {
  readonly id: string;
  readonly realName: string;
  readonly version: number;
}

export interface CreateUserProfileRequest {
  readonly realName: string;
}

export interface UpdateUserProfileRequest {
  readonly realName: string;
  readonly version: number;
}
