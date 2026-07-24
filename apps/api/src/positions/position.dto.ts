import { IsOptional, IsString, IsUUID, Length, Matches } from 'class-validator';

export class ListPositionsQuery {
  @IsUUID()
  declare organizationId: string;

  @IsOptional()
  @IsUUID()
  declare siteId?: string;
}

export class CreatePositionDto {
  @IsUUID()
  declare organizationId: string;

  @IsOptional()
  @IsUUID()
  declare siteId?: string;

  @IsString()
  @Matches(/^[A-Z0-9-]{1,32}$/)
  declare code: string;

  @IsString()
  @Length(1, 120)
  declare name: string;

  @IsOptional()
  @IsString()
  @Length(1, 500)
  declare description?: string;

  @IsOptional()
  @Matches(/^[a-z][a-z0-9-]{1,31}$/)
  declare colorToken?: string;
}
