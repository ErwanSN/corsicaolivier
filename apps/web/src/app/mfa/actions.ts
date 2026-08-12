'use server';

import { redirect } from 'next/navigation';

import { createAuthRateLimitIdentity } from '../../lib/supabase/auth-rate-limit';
import { createSupabaseServerClient } from '../../lib/supabase/server';

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const TOTP_PATTERN = /^\d{6}$/;

export type MfaEnrollmentState = Readonly<{
  error?: string;
  enrollment?: Readonly<{
    factorId: string;
    qrCode: string;
    secret: string;
  }>;
}>;

export type MfaVerificationState = Readonly<{ error?: string }>;

export async function enrollTotp(
  _previousState: MfaEnrollmentState,
): Promise<MfaEnrollmentState> {
  void _previousState;
  const supabase = await createSupabaseServerClient();
  if (!supabase) return { error: 'Service de sécurité indisponible.' };

  let user;
  try {
    user = await supabase.auth.getUser();
  } catch {
    return { error: 'Service de sécurité momentanément indisponible.' };
  }
  if (!user.data.user) redirect('/login');

  let assurance;
  let factors;
  try {
    assurance = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    factors = await supabase.auth.mfa.listFactors();
  } catch {
    return { error: 'Service de sécurité momentanément indisponible.' };
  }
  if (assurance.data?.currentLevel === 'aal2') redirect('/tools');

  if (factors.error) {
    return { error: 'Impossible de charger les facteurs de sécurité.' };
  }

  const verified = factors.data.totp.find(
    (factor) => factor.status === 'verified',
  );
  if (verified) {
    return {
      error: 'Un facteur existe déjà. Saisissez le code de votre application.',
    };
  }

  // An interrupted enrollment is unusable because its secret is no longer
  // available. Remove only unverified TOTP factors before issuing a new one.
  for (const factor of factors.data.all) {
    if (factor.factor_type === 'totp' && factor.status === 'unverified') {
      let removal;
      try {
        removal = await supabase.auth.mfa.unenroll({ factorId: factor.id });
      } catch {
        return { error: 'Impossible de reprendre la configuration MFA.' };
      }
      if (removal.error) {
        return { error: 'Impossible de reprendre la configuration MFA.' };
      }
    }
  }

  let enrollment;
  try {
    enrollment = await supabase.auth.mfa.enroll({
      factorType: 'totp',
      friendlyName: 'Corsica Linea',
    });
  } catch {
    return { error: 'Impossible de configurer le facteur de sécurité.' };
  }

  if (
    enrollment.error ||
    !UUID_PATTERN.test(enrollment.data.id) ||
    !enrollment.data.totp.qr_code.startsWith('data:image/')
  ) {
    return { error: 'Impossible de configurer le facteur de sécurité.' };
  }

  return {
    enrollment: {
      factorId: enrollment.data.id,
      qrCode: enrollment.data.totp.qr_code,
      secret: enrollment.data.totp.secret,
    },
  };
}

export async function verifyTotp(
  _previousState: MfaVerificationState,
  formData: FormData,
): Promise<MfaVerificationState> {
  void _previousState;
  const factorId = formData.get('factorId');
  const codeValue = formData.get('code');
  const code = typeof codeValue === 'string' ? codeValue.trim() : '';

  if (
    typeof factorId !== 'string' ||
    !UUID_PATTERN.test(factorId) ||
    !TOTP_PATTERN.test(code)
  ) {
    return { error: 'Saisissez le code à 6 chiffres.' };
  }

  const supabase = await createSupabaseServerClient(
    createAuthRateLimitIdentity('mfa-factor', factorId),
  );
  if (!supabase) return { error: 'Service de sécurité indisponible.' };

  let user;
  try {
    user = await supabase.auth.getUser();
  } catch {
    return { error: 'Service de sécurité momentanément indisponible.' };
  }
  if (!user.data.user) redirect('/login');

  let verification;
  try {
    verification = await supabase.auth.mfa.challengeAndVerify({
      factorId,
      code,
    });
  } catch {
    return { error: 'Service de sécurité momentanément indisponible.' };
  }
  if (verification.error) {
    return { error: 'Code incorrect ou expiré.' };
  }

  let assurance;
  try {
    assurance = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  } catch {
    return { error: 'Service de sécurité momentanément indisponible.' };
  }
  if (assurance.error || assurance.data.currentLevel !== 'aal2') {
    return { error: 'La session renforcée n’a pas pu être établie.' };
  }

  redirect('/tools');
}
