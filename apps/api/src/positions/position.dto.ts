import { Transform, Type } from 'class-transformer';
import {
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Matches,
  Max,
  Min,
} from 'class-validator';

export class ListPositionsQuery {
  @IsUUID()
  declare organizationId: string;

  @IsOptional()
  @IsUUID()
  declare siteId?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100_000)
  declare page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(200)
  declare pageSize?: number;

  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @Length(1, 80)
  declare q?: string;
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
