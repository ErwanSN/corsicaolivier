import { IsOptional, IsString, IsUUID, Length, Matches } from 'class-validator';

export class CreateSiteDto {
  @IsUUID()
  declare organizationId: string;

  @IsOptional()
  @Matches(/^[A-Z0-9-]{2,24}$/)
  declare code?: string;

  @IsString()
  @Length(2, 120)
  declare name: string;

  @IsOptional()
  @IsString()
  @Length(1, 64)
  declare timezone?: string;
}
