import { Resend } from 'resend';
import { RESEND_API_KEY } from './env.js';

if (!RESEND_API_KEY) {
  console.warn('⚠️  RESEND_API_KEY not found. Email functionality will be disabled.');
}

const resend = new Resend(RESEND_API_KEY);

// Email templates and utilities
export const sendVerificationEmail = async (email, verificationCode, userName) => {
  if (!RESEND_API_KEY) {
    console.log('📧 Email service disabled - would send verification code:', verificationCode);
    return { success: true, messageId: 'test-mode' };
  }

  try {
    const { data, error } = await resend.emails.send({
      from: 'ToutAunClicLa <noreply@toutaunclicla.com>',
      to: [email],
      subject: '🔐 Vérifiez votre compte ToutAunClicLa',
      html: getVerificationEmailTemplate(verificationCode, userName),
    });

    if (error) {
      throw error;
    }

    return { success: true, messageId: data.id };
  } catch (error) {
    console.error('Error sending verification email:', error);
    throw new Error('Failed to send verification email');
  }
};

// ── MÓDULO PRO ──────────────────────────────────────────────────────────────
// Sender propio del módulo Pro. Cuando el dominio pro.toutaunclicla esté listo,
// cambia SOLO esta constante a 'ToutAunClicLa Pro <noreply@pro.toutaunclicla.com>'.
const PRO_EMAIL_FROM = 'ToutAunClicLa Pro <noreply@toutaunclicla.com>';

export const sendProVerificationEmail = async (email, verificationCode, userName) => {
  if (!RESEND_API_KEY) {
    console.log('📧 Pro: email deshabilitado - código de verificación:', verificationCode);
    return { success: true, messageId: 'test-mode' };
  }

  try {
    const { data, error } = await resend.emails.send({
      from: PRO_EMAIL_FROM,
      to: [email],
      subject: '🔐 Vérifiez votre compte professionnel ToutAunClicLa',
      html: getVerificationEmailTemplate(verificationCode, userName),
    });

    if (error) {
      throw error;
    }

    return { success: true, messageId: data.id };
  } catch (error) {
    console.error('Error sending pro verification email:', error);
    throw new Error('Failed to send pro verification email');
  }
};

export const sendProPasswordResetEmail = async (email, resetCode, userName) => {
  if (!RESEND_API_KEY) {
    console.log('📧 Pro: email deshabilitado - código de restablecimiento:', resetCode);
    return { success: true, messageId: 'test-mode' };
  }

  try {
    const { data, error } = await resend.emails.send({
      from: PRO_EMAIL_FROM,
      to: [email],
      subject: '🔑 Réinitialisation de votre mot de passe professionnel',
      html: getPasswordResetEmailTemplate(resetCode, userName),
    });

    if (error) {
      throw error;
    }

    return { success: true, messageId: data.id };
  } catch (error) {
    console.error('Error sending pro password reset email:', error);
    throw new Error('Failed to send pro password reset email');
  }
};

export const sendWelcomeEmail = async (email, userName) => {
  if (!RESEND_API_KEY) {
    console.log('📧 Email service disabled - would send welcome email to:', email);
    return { success: true, messageId: 'test-mode' };
  }

  try {
    const { data, error } = await resend.emails.send({
      from: 'ToutAunClicLa <welcome@toutaunclicla.com>',
      to: [email],
      subject: `Bonjour ${userName || 'Ami'}`,
      html: getWelcomeEmailTemplate(userName),
    });

    if (error) {
      throw error;
    }

    return { success: true, messageId: data.id };
  } catch (error) {
    console.error('Error sending welcome email:', error);
    throw new Error('Failed to send welcome email');
  }
};

export const sendPasswordResetEmail = async (email, resetCode, userName) => {
  if (!RESEND_API_KEY) {
    console.log('📧 Email service disabled - would send password reset code:', resetCode);
    return { success: true, messageId: 'test-mode' };
  }

  try {
    const { data, error } = await resend.emails.send({
      from: 'ToutAunClicLa <noreply@toutaunclicla.com>',
      to: [email],
      subject: '🔑 Réinitialisation de votre mot de passe',
      html: getPasswordResetEmailTemplate(resetCode, userName),
    });

    if (error) {
      throw error;
    }

    return { success: true, messageId: data.id };
  } catch (error) {
    console.error('Error sending password reset email:', error);
    throw new Error('Failed to send password reset email');
  }
};

// Template para email de verificación
const getVerificationEmailTemplate = (verificationCode, userName) => `
<!DOCTYPE html>
<html lang="fr">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Vérifiez votre compte</title>
    <style>
        body {
            margin: 0;
            padding: 0;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            line-height: 1.6;
        }
        .container {
            max-width: 600px;
            margin: 0 auto;
            background: white;
            border-radius: 16px;
            box-shadow: 0 20px 40px rgba(0, 0, 0, 0.1);
            overflow: hidden;
            margin-top: 40px;
            margin-bottom: 40px;
        }
        .header {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            padding: 40px 30px;
            text-align: center;
            color: white;
        }
        .logo {
            font-size: 28px;
            font-weight: bold;
            margin-bottom: 10px;
            letter-spacing: -0.5px;
        }
        .tagline {
            font-size: 16px;
            opacity: 0.9;
            margin: 0;
        }
        .content {
            padding: 40px 30px;
            text-align: center;
        }
        .greeting {
            font-size: 24px;
            color: #333;
            margin-bottom: 20px;
            font-weight: 600;
        }
        .message {
            font-size: 16px;
            color: #666;
            margin-bottom: 30px;
            line-height: 1.6;
        }
        .verification-box {
            background: linear-gradient(135deg, #f8faff 0%, #f1f5ff 100%);
            border: 2px solid #667eea;
            border-radius: 12px;
            padding: 30px;
            margin: 30px 0;
            text-align: center;
        }
        .verification-label {
            font-size: 14px;
            color: #666;
            margin-bottom: 10px;
            text-transform: uppercase;
            letter-spacing: 1px;
            font-weight: 600;
        }
        .verification-code {
            font-size: 36px;
            font-weight: bold;
            color: #667eea;
            letter-spacing: 8px;
            font-family: 'Courier New', monospace;
            margin: 15px 0;
        }
        .code-instruction {
            font-size: 14px;
            color: #888;
            margin-top: 15px;
        }
        .warning {
            background: #fff3cd;
            border: 1px solid #ffeaa7;
            border-radius: 8px;
            padding: 20px;
            margin: 30px 0;
            color: #856404;
            font-size: 14px;
        }
        .footer {
            background: #f8f9fa;
            padding: 30px;
            text-align: center;
            border-top: 1px solid #e9ecef;
        }
        .footer-text {
            color: #666;
            font-size: 14px;
            margin: 0;
        }
        .footer-link {
            color: #667eea;
            text-decoration: none;
        }
        .footer-link:hover {
            text-decoration: underline;
        }
        .social-links {
            margin-top: 20px;
        }
        .social-link {
            display: inline-block;
            margin: 0 10px;
            color: #667eea;
            text-decoration: none;
            font-size: 14px;
        }
        .divider {
            height: 1px;
            background: linear-gradient(90deg, transparent, #e9ecef, transparent);
            margin: 30px 0;
        }
        @media (max-width: 600px) {
            .container {
                margin: 0;
                border-radius: 0;
            }
            .header, .content, .footer {
                padding: 30px 20px;
            }
            .verification-code {
                font-size: 28px;
                letter-spacing: 4px;
            }
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <div class="logo">🏪 ToutAunClicLa</div>
            <p class="tagline">Produits uniques d'Amérique Latine</p>
        </div>
        
        <div class="content">
            <h1 class="greeting">Bonjour ${userName || 'Utilisateur'} ! 👋</h1>
            
            <p class="message">
                Merci de vous être inscrit sur <strong>ToutAunClicLa</strong>. Pour finaliser la création de votre compte et accéder à nos produits exclusifs d'Amérique Latine, nous devons vérifier votre adresse e-mail.
            </p>
            
            <div class="verification-box">
                <div class="verification-label">Votre code de vérification</div>
                <div class="verification-code">${verificationCode}</div>
                <div class="code-instruction">
                    Saisissez ce code dans l'application pour vérifier votre compte
                </div>
            </div>
            
            <div class="warning">
                <strong>⏰ Important :</strong> Ce code expire dans 15 minutes pour des raisons de sécurité. Si vous ne l'utilisez pas à temps, vous pouvez en demander un nouveau depuis l'application.
            </div>
            
            <div class="divider"></div>
            
            <p class="message">
                Une fois votre compte vérifié, vous pourrez :
                <br>• Explorer des produits authentiques de toute l'Amérique Latine
                <br>• Effectuer des achats sécurisés avec Stripe
                <br>• Sauvegarder vos produits favoris
                <br>• Recevoir des offres exclusives
            </p>
        </div>
        
        <div class="footer">
            <p class="footer-text">
                Si vous n'avez pas créé ce compte, vous pouvez ignorer cet e-mail.
                <br>
                Besoin d'aide ? Contactez-nous à 
                <a href="mailto:serviceclient@toutaunclicla.com" class="footer-link">serviceclient@toutaunclicla.com</a>
            </p>
            
            <div class="social-links">
                <a href="#" class="social-link">📱 App</a>
                <a href="#" class="social-link">🌐 Web</a>
                <a href="#" class="social-link">📧 Support</a>
            </div>
            
            <div class="divider"></div>
            
            <p class="footer-text">
                © 2024 ToutAunClicLa. Tous droits réservés.
                <br>
                <a href="#" class="footer-link">Politique de Confidentialité</a> • 
                <a href="#" class="footer-link">Conditions de Service</a>
            </p>
        </div>
    </div>
</body>
</html>
`;

// Template para email de bienvenida
const getWelcomeEmailTemplate = (userName) => `
<!DOCTYPE html>
<html lang="fr">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Bienvenue chez ToutAunClicLa !</title>
    <style>
        body {
            margin: 0;
            padding: 0;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            line-height: 1.6;
        }
        a{
            color: white;
        }
        .container {
            max-width: 600px;
            margin: 0 auto;
            background: white;
            border-radius: 16px;
            box-shadow: 0 20px 40px rgba(0, 0, 0, 0.1);
            overflow: hidden;
            margin-top: 40px;
            margin-bottom: 40px;
        }
        .header {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            padding: 40px 30px;
            text-align: center;
            color: white;
        }
        .logo {
            font-size: 28px;
            font-weight: bold;
            margin-bottom: 10px;
            letter-spacing: -0.5px;
        }
        .welcome-message {
            font-size: 18px;
            margin: 0;
            opacity: 0.95;
        }
        .content {
            padding: 40px 30px;
        }
        .greeting {
            font-size: 28px;
            color: #333;
            margin-bottom: 20px;
            font-weight: 600;
            text-align: center;
        }
        .message {
            font-size: 16px;
            color: #666;
            margin-bottom: 30px;
            line-height: 1.6;
            text-align: center;
        }
        .features {
            display: grid;
            gap: 20px;
            margin: 30px 0;
        }
        .feature {
            display: flex;
            align-items: center;
            padding: 20px;
            background: #f8faff;
            border-radius: 12px;
            border-left: 4px solid #667eea;
        }
        .feature-icon {
            font-size: 24px;
            margin-right: 15px;
        }
        .feature-content {
            flex: 1;
        }
        .feature-title {
            font-weight: 600;
            color: #333;
            margin-bottom: 5px;
        }
        .feature-description {
            color: #666;
            font-size: 14px;
        }
        .cta-button {
            display: inline-block;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 15px 30px;
            border-radius: 50px;
            text-decoration: none;
            font-weight: 600;
            margin: 30px auto;
            text-align: center;
            box-shadow: 0 4px 15px rgba(102, 126, 234, 0.3);
            transition: transform 0.2s;
        }
        .cta-button:hover {
            transform: translateY(-2px);
        }
        .coupon-section {
            background: linear-gradient(135deg, #fff9e6 0%, #fff4cc 100%);
            border: 2px solid #ffa500;
            border-radius: 12px;
            padding: 30px;
            margin: 30px 0;
            text-align: center;
        }
        .coupon-label {
            font-size: 14px;
            color: #666;
            margin-bottom: 10px;
            text-transform: uppercase;
            letter-spacing: 1px;
            font-weight: 600;
        }
        .coupon-code {
            font-size: 28px;
            font-weight: bold;
            color: #ff6b35;
            letter-spacing: 2px;
            font-family: 'Courier New', monospace;
            margin: 15px 0;
            padding: 15px;
            background: white;
            border-radius: 8px;
            border: 2px dashed #ffa500;
        }
        .coupon-info {
            font-size: 14px;
            color: #666;
            margin-top: 15px;
            line-height: 1.5;
        }
        .footer {
            background: #f8f9fa;
            padding: 30px;
            text-align: center;
            border-top: 1px solid #e9ecef;
        }
        .footer-text {
            color: #666;
            font-size: 14px;
            margin: 0;
        }
        .footer-link {
            color: #667eea;
            text-decoration: none;
        }
        @media (max-width: 600px) {
            .container {
                margin: 0;
                border-radius: 0;
            }
            .header, .content, .footer {
                padding: 30px 20px;
            }
            .feature {
                flex-direction: column;
                text-align: center;
            }
            .feature-icon {
                margin-right: 0;
                margin-bottom: 10px;
            }
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <div class="logo">🏪 ToutAunClicLa</div>
            <p class="welcome-message">Votre aventure latino-américaine commence ici !</p>
        </div>
        
        <div class="content">
            <h1 class="greeting">Bienvenue ${userName} ! 🎉</h1>
            
            <p class="message">
                Votre compte a été vérifié avec succès. Vous pouvez maintenant explorer la collection la plus authentique de produits d'Amérique Latine, des artisanats traditionnels aux innovations modernes.
            </p>

            <div class="features">
                <div class="feature">
                    <div class="feature-icon">🎁</div>
                    <div class="feature-content">
                        <div class="feature-title">Produits Uniques</div>
                        <div class="feature-description">Découvrez des artisanats, aliments et produits exclusifs de toute l'Amérique Latine</div>
                    </div>
                </div>
                
                <div class="feature">
                    <div class="feature-icon">🛡️</div>
                    <div class="feature-content">
                        <div class="feature-title">Achats Sécurisés</div>
                        <div class="feature-description">Paiements protégés avec Stripe et expéditions sécurisées dans toute l'Amérique</div>
                    </div>
                </div>
                
                <div class="feature">
                    <div class="feature-icon">⭐</div>
                    <div class="feature-content">
                        <div class="feature-title">Offres Exclusives</div>
                        <div class="feature-description">Accès prioritaire aux réductions et produits en édition limitée</div>
                    </div>
                </div>
            </div>
            
            <div style="text-align: center;">
                <a href="https://www.toutaunclicla.com/" class="cta-button">🛍️ Commencer à Acheter</a>
            </div>
        </div>
        
        <div class="footer">
            <p class="footer-text">
                Merci de rejoindre notre communauté d'amoureux de la culture latino-américaine.
                <br>
                Des questions ? Écrivez-nous à <a href="mailto:soporte@toutaunclicla.com" class="footer-link">serviceclient@toutaunclicla.com</a>
            </p>
        </div>
    </div>
</body>
</html>
`;

// Template para email de restablecimiento de contraseña
const getPasswordResetEmailTemplate = (resetCode, userName) => `
<!DOCTYPE html>
<html lang="fr">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Réinitialisation de mot de passe</title>
    <style>
        body {
            margin: 0;
            padding: 0;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            line-height: 1.6;
        }
        .container {
            max-width: 600px;
            margin: 0 auto;
            background: white;
            border-radius: 16px;
            box-shadow: 0 20px 40px rgba(0, 0, 0, 0.1);
            overflow: hidden;
            margin-top: 40px;
            margin-bottom: 40px;
        }
        .header {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            padding: 40px 30px;
            text-align: center;
            color: white;
        }
        .logo {
            font-size: 28px;
            font-weight: bold;
            margin-bottom: 10px;
            letter-spacing: -0.5px;
        }
        .tagline {
            font-size: 16px;
            opacity: 0.9;
            margin: 0;
        }
        .content {
            padding: 40px 30px;
            text-align: center;
        }
        .greeting {
            font-size: 24px;
            color: #333;
            margin-bottom: 20px;
            font-weight: 600;
        }
        .message {
            font-size: 16px;
            color: #666;
            margin-bottom: 30px;
            line-height: 1.6;
        }
        .reset-box {
            background: linear-gradient(135deg, #fff4f4 0%, #ffe6e6 100%);
            border: 2px solid #ff6b6b;
            border-radius: 12px;
            padding: 30px;
            margin: 30px 0;
            text-align: center;
        }
        .reset-label {
            font-size: 14px;
            color: #666;
            margin-bottom: 10px;
            text-transform: uppercase;
            letter-spacing: 1px;
            font-weight: 600;
        }
        .reset-code {
            font-size: 36px;
            font-weight: bold;
            color: #ff6b6b;
            letter-spacing: 8px;
            font-family: 'Courier New', monospace;
            margin: 15px 0;
        }
        .code-instruction {
            font-size: 14px;
            color: #888;
            margin-top: 15px;
        }
        .warning {
            background: #fff3cd;
            border: 1px solid #ffeaa7;
            border-radius: 8px;
            padding: 20px;
            margin: 30px 0;
            color: #856404;
            font-size: 14px;
        }
        .security-notice {
            background: #f8f9fa;
            border-left: 4px solid #667eea;
            border-radius: 8px;
            padding: 20px;
            margin: 30px 0;
            text-align: left;
        }
        .security-notice strong {
            color: #667eea;
        }
        .footer {
            background: #f8f9fa;
            padding: 30px;
            text-align: center;
            border-top: 1px solid #e9ecef;
        }
        .footer-text {
            color: #666;
            font-size: 14px;
            margin: 0;
        }
        .footer-link {
            color: #667eea;
            text-decoration: none;
        }
        .footer-link:hover {
            text-decoration: underline;
        }
        .divider {
            height: 1px;
            background: linear-gradient(90deg, transparent, #e9ecef, transparent);
            margin: 30px 0;
        }
        @media (max-width: 600px) {
            .container {
                margin: 0;
                border-radius: 0;
            }
            .header, .content, .footer {
                padding: 30px 20px;
            }
            .reset-code {
                font-size: 28px;
                letter-spacing: 4px;
            }
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <div class="logo">🏪 ToutAunClicLa</div>
            <p class="tagline">Réinitialisation de mot de passe</p>
        </div>

        <div class="content">
            <h1 class="greeting">Bonjour ${userName || 'Utilisateur'} ! 🔑</h1>

            <p class="message">
                Nous avons reçu une demande de réinitialisation de mot de passe pour votre compte <strong>ToutAunClicLa</strong>. Utilisez le code ci-dessous pour créer un nouveau mot de passe.
            </p>

            <div class="reset-box">
                <div class="reset-label">Code de réinitialisation</div>
                <div class="reset-code">${resetCode}</div>
                <div class="code-instruction">
                    Saisissez ce code dans l'application pour réinitialiser votre mot de passe
                </div>
            </div>

            <div class="warning">
                <strong>⏰ Important :</strong> Ce code expire dans 15 minutes pour des raisons de sécurité. Si vous ne l'utilisez pas à temps, vous devrez demander un nouveau code.
            </div>

            <div class="security-notice">
                <strong>🛡️ Conseil de sécurité :</strong>
                <br>
                Si vous n'avez pas demandé cette réinitialisation, veuillez ignorer cet e-mail et votre mot de passe restera inchangé. Pour plus de sécurité, nous vous recommandons de changer votre mot de passe régulièrement.
            </div>

            <div class="divider"></div>

            <p class="message">
                Après avoir réinitialisé votre mot de passe, vous pourrez vous connecter normalement à votre compte et continuer à profiter de nos produits d'Amérique Latine.
            </p>
        </div>

        <div class="footer">
            <p class="footer-text">
                Vous n'avez pas demandé cette réinitialisation ? Contactez-nous immédiatement.
                <br>
                Support technique :
                <a href="mailto:serviceclient@toutaunclicla.com" class="footer-link">serviceclient@toutaunclicla.com</a>
            </p>

            <div class="divider"></div>

            <p class="footer-text">
                © 2024 ToutAunClicLa. Tous droits réservés.
                <br>
                <a href="#" class="footer-link">Politique de Confidentialité</a> •
                <a href="#" class="footer-link">Conditions de Service</a>
            </p>
        </div>
    </div>
</body>
</html>
`;

export const sendProAccountDeletedEmail = async (email, userName) => {
  if (!RESEND_API_KEY) {
    console.log('📧 Pro: email deshabilitado - confirmación de eliminación de cuenta:', email);
    return { success: true, messageId: 'test-mode' };
  }

  try {
    const { data, error } = await resend.emails.send({
      from: PRO_EMAIL_FROM,
      to: [email],
      subject: 'Votre compte professionnel a été supprimé',
      html: getAccountDeletedEmailTemplate(userName),
    });

    if (error) {
      throw error;
    }

    return { success: true, messageId: data.id };
  } catch (error) {
    console.error('Error sending pro account deleted email:', error);
    // No relanzamos: la cuenta ya fue eliminada, un fallo de email no debe
    // reportarse como error de la operación de borrado.
    return { success: false, error: error.message };
  }
};

// Template simple de confirmación (no requiere código ni acción del usuario)
const getAccountDeletedEmailTemplate = (userName) => `
<!DOCTYPE html>
<html lang="fr">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Compte supprimé</title>
    <style>
        body {
            margin: 0;
            padding: 0;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            line-height: 1.6;
        }
        .container {
            max-width: 600px;
            margin: 40px auto;
            background: white;
            border-radius: 16px;
            box-shadow: 0 20px 40px rgba(0, 0, 0, 0.1);
            overflow: hidden;
        }
        .header {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            padding: 40px 30px;
            text-align: center;
            color: white;
        }
        .logo { font-size: 28px; font-weight: bold; letter-spacing: -0.5px; }
        .content { padding: 40px 30px; text-align: center; }
        .greeting { font-size: 22px; color: #333; margin-bottom: 20px; font-weight: 600; }
        .message { font-size: 16px; color: #666; margin-bottom: 20px; }
        .footer {
            background: #f8f9fa;
            padding: 30px;
            text-align: center;
            border-top: 1px solid #e9ecef;
            font-size: 14px;
            color: #666;
        }
        .footer-link { color: #667eea; text-decoration: none; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <div class="logo">🏪 ToutAunClicLa Pro</div>
        </div>
        <div class="content">
            <h1 class="greeting">Au revoir ${userName || ''} 👋</h1>
            <p class="message">
                Votre compte professionnel et votre fiche publique ont été supprimés définitivement,
                ainsi que toutes les données associées (réseaux sociaux, statistiques, abonnement).
            </p>
            <p class="message">
                Si vous n'êtes pas à l'origine de cette suppression, contactez-nous immédiatement.
            </p>
        </div>
        <div class="footer">
            Support :
            <a href="mailto:serviceclient@toutaunclicla.com" class="footer-link">serviceclient@toutaunclicla.com</a>
        </div>
    </div>
</body>
</html>
`;

export { resend };
export default resend;
