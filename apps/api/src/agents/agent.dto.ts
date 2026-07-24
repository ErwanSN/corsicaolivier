import {
  IsBoolean,
  IsDateString,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Matches,
} from 'class-validator';

export class ListAgentsQuery {
  @IsOptional()
  @IsUUID()
  declare siteId?: string;

  @IsOptional()
  @IsUUID()
  declare organizationId?: string;
}

export class CreateAgentDto {
  @IsUUID()
  declare organizationId: string;

  @IsUUID()
  declare primarySiteId: string;

  @IsOptional()
  @IsUUID()
  declare userId?: string;

  @IsOptional()
  @IsString()
  @Matches(/^[A-Za-z0-9._-]{1,32}$/)
  declare employeeNumber?: string;

  @IsString()
  @Length(1, 160)
  declare displayName: string;

  @IsOptional()
  @IsBoolean()
  declare active?: boolean;

  @IsOptional()
  @IsDateString({ strict: true })
  declare hiredOn?: string;
}

export class UpdateAgentDto {
  @IsUUID()
  declare organizationId: string;

  @IsOptional()
  @IsUUID()
  declare primarySiteId?: string;

  @IsOptional()
  @IsString()
  @Matches(/^[A-Za-z0-9._-]{1,32}$/)
  declare employeeNumber?: string;

  @IsOptional()
  @IsString()
  @Length(1, 160)
  declare displayName?: string;

  @IsOptional()
  @IsBoolean()
  declare active?: boolean;

  @IsOptional()
  @IsDateString({ strict: true })
  declare hiredOn?: string | null;

  @IsOptional()
  @IsDateString({ strict: true })
  declare leftOn?: string | null;
}
