// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { EmailProviderSettings, Examination } from '../types';

const authMock = vi.hoisted(() => ({
  useAuth: vi.fn(),
}));
const patientServiceMock = vi.hoisted(() => ({ getPatient: vi.fn() }));
const providerServiceMock = vi.hoisted(() => ({ getProvider: vi.fn() }));
const examinationServiceMock = vi.hoisted(() => ({ emailReport: vi.fn() }));
const printServiceMock = vi.hoisted(() => ({ getPdfBlob: vi.fn() }));

vi.mock('../contexts/AuthContext', () => authMock);
vi.mock('../services/patientService', () => ({ patientService: patientServiceMock }));
vi.mock('../services/emailProviderService', () => ({ emailProviderService: providerServiceMock }));
vi.mock('../services/examinationService', () => ({ examinationService: examinationServiceMock }));
vi.mock('./printService', () => ({ printService: printServiceMock }));

import EmailReportButton from './EmailReportButton';

// jsdom has no ResizeObserver, which Carbon's TextArea (character counter) uses.
vi.stubGlobal(
  'ResizeObserver',
  class {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
);

const PDF_TEXT = '%PDF-1.4 test';

const configuredProvider: EmailProviderSettings = {
  configured: true,
  provider: 'google',
  from_email: 'dr.ivanova@gmail.com',
  from_name: 'Dr. Maria Ivanova',
};

function makeExam(overrides: Partial<Examination> = {}): Examination {
  return {
    examinationId: 'exam-1',
    mrn: 'MRN-IVAN-2026-000001',
    patientId: 'patient-1',
    patientName: 'Ivana Petrova',
    examDate: '2026-11-07',
    status: 'completed',
    examinationType: 'prenatal',
    createdBy: 'u1',
    createdAt: '2026-11-07T10:00:00Z',
    isDeleted: false,
    ...overrides,
  };
}

function renderButton(exam: Examination = makeExam()) {
  return render(
    <MemoryRouter>
      <EmailReportButton examination={exam} />
    </MemoryRouter>
  );
}

async function openDialog() {
  fireEvent.click(screen.getByRole('button', { name: 'Email examination report' }));
  await waitFor(() => expect(providerServiceMock.getProvider).toHaveBeenCalled());
}

const recipientInput = () => screen.getByLabelText('Recipient Email') as HTMLInputElement;
const confirmButton = () => screen.getByRole('button', { name: 'Confirm and send' }) as HTMLButtonElement;

/** Error shaped like the one examinationService throws: axios error kept as `cause`. */
function serviceError(apiErrorCode: string | undefined, message = 'raw server text') {
  return new Error(message, { cause: { apiErrorCode } });
}

describe('EmailReportButton', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authMock.useAuth.mockReturnValue({ user: { id: 'u1', role: 'doctor' } });
    patientServiceMock.getPatient.mockResolvedValue({ patientId: 'patient-1', email: 'patient@example.com' });
    providerServiceMock.getProvider.mockResolvedValue(configuredProvider);
    printServiceMock.getPdfBlob.mockResolvedValue({
      arrayBuffer: async () => new TextEncoder().encode(PDF_TEXT).buffer,
    });
    examinationServiceMock.emailReport.mockResolvedValue({
      message: 'Report accepted for delivery',
      recipient_email: 'patient@example.com',
      delivery_status: 'accepted',
      recipient_overridden: false,
    });
  });

  afterEach(() => {
    cleanup();
  });

  it('is hidden for viewers', () => {
    authMock.useAuth.mockReturnValue({ user: { id: 'u2', role: 'viewer' } });
    renderButton();
    expect(screen.queryByRole('button', { name: 'Email examination report' })).toBeNull();
  });

  it.each(['admin', 'doctor'])('is shown for %s', (role) => {
    authMock.useAuth.mockReturnValue({ user: { id: 'u1', role } });
    renderButton();
    expect(screen.getByRole('button', { name: 'Email examination report' })).toBeTruthy();
  });

  it.each(['draft', 'completed', 'reviewed'] as const)('is enabled for a %s examination', (status) => {
    renderButton(makeExam({ status }));
    expect((screen.getByRole('button', { name: 'Email examination report' }) as HTMLButtonElement).disabled).toBe(false);
  });

  it('pre-fills the recipient with the patient profile email and shows the read-only sender', async () => {
    renderButton();
    await openDialog();
    await waitFor(() => expect(recipientInput().value).toBe('patient@example.com'));
    expect(patientServiceMock.getPatient).toHaveBeenCalledWith('patient-1');
    expect(screen.getByText('From: Dr. Maria Ivanova <dr.ivanova@gmail.com>')).toBeTruthy();
    expect(screen.queryByText(/Different from the patient's email/)).toBeNull();
    expect(screen.queryByText('Patient has no email in the profile')).toBeNull();
    expect(confirmButton().disabled).toBe(false);
  });

  it('uses the default subject with the exam type label and date, without patient name or MRN', async () => {
    renderButton(makeExam({ examinationType: 'first_trimester' }));
    await openDialog();
    await waitFor(() => expect(recipientInput().value).toBe('patient@example.com'));
    const subject = (screen.getByLabelText('Subject') as HTMLInputElement).value;
    expect(subject).toBe('Examination report \u2014 First Trimester \u2014 2026-11-07');
    expect(subject).not.toContain('Ivana');
    expect(subject).not.toContain('MRN');
    expect(subject).not.toContain('Ultrasound Prenatal');
  });

  it('warns when the patient has no email and keeps Confirm disabled until a valid address is typed', async () => {
    patientServiceMock.getPatient.mockResolvedValue({ patientId: 'patient-1' });
    renderButton();
    await openDialog();
    await screen.findByText('Patient has no email in the profile');
    expect(recipientInput().value).toBe('');
    expect(confirmButton().disabled).toBe(true);

    fireEvent.change(recipientInput(), { target: { value: 'new@example.com' } });
    expect(confirmButton().disabled).toBe(false);
    // No profile email to differ from, so no override note
    expect(screen.queryByText(/Different from the patient's email/)).toBeNull();
  });

  it('shows the override note when the recipient differs from the profile email', async () => {
    renderButton();
    await openDialog();
    await waitFor(() => expect(recipientInput().value).toBe('patient@example.com'));

    fireEvent.change(recipientInput(), { target: { value: 'other@example.com' } });
    expect(
      screen.getByText("Different from the patient's email in the profile — this will be recorded in the audit log")
    ).toBeTruthy();

    fireEvent.change(recipientInput(), { target: { value: 'patient@example.com' } });
    expect(screen.queryByText(/Different from the patient's email/)).toBeNull();
  });

  it.each(['not-an-email', 'a@example.com, b@example.com', 'a@example.com;b@example.com', 'Name <a@example.com>', ''])(
    'keeps Confirm disabled for the invalid recipient %j',
    async (value) => {
      renderButton();
      await openDialog();
      await waitFor(() => expect(recipientInput().value).toBe('patient@example.com'));
      fireEvent.change(recipientInput(), { target: { value } });
      expect(confirmButton().disabled).toBe(true);
    }
  );

  it('shows the draft warning only for draft examinations', async () => {
    renderButton(makeExam({ status: 'draft' }));
    await openDialog();
    await screen.findByText('This examination is a draft and may be incomplete.');
    expect(confirmButton().disabled).toBe(false);
  });

  it('does not show the draft warning for a completed examination', async () => {
    renderButton(makeExam({ status: 'completed' }));
    await openDialog();
    await waitFor(() => expect(recipientInput().value).toBe('patient@example.com'));
    expect(screen.queryByText('This examination is a draft and may be incomplete.')).toBeNull();
  });

  it('replaces the form with a link to Email Settings and disables sending when not configured', async () => {
    providerServiceMock.getProvider.mockResolvedValue({ configured: false });
    renderButton();
    await openDialog();
    const link = await screen.findByRole('link', { name: 'Go to Email Settings' });
    expect(link.getAttribute('href')).toBe('/email-settings');
    expect(screen.queryByLabelText('Recipient Email')).toBeNull();
    expect(confirmButton().disabled).toBe(true);
  });

  it('does not generate the PDF or call the API until Confirm and send is pressed', async () => {
    renderButton();
    await openDialog();
    await waitFor(() => expect(recipientInput().value).toBe('patient@example.com'));
    fireEvent.change(recipientInput(), { target: { value: 'other@example.com' } });
    fireEvent.change(screen.getByLabelText('Subject'), { target: { value: 'Edited subject' } });

    expect(printServiceMock.getPdfBlob).not.toHaveBeenCalled();
    expect(examinationServiceMock.emailReport).not.toHaveBeenCalled();

    // Cancelling sends nothing
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(printServiceMock.getPdfBlob).not.toHaveBeenCalled();
    expect(examinationServiceMock.emailReport).not.toHaveBeenCalled();
  });

  it('sends the contract body with an override recipient, subject, message, file name and base64 PDF', async () => {
    renderButton();
    await openDialog();
    await waitFor(() => expect(recipientInput().value).toBe('patient@example.com'));
    fireEvent.change(recipientInput(), { target: { value: '  other@example.com ' } });
    fireEvent.change(screen.getByLabelText('Subject'), { target: { value: 'Edited subject' } });
    fireEvent.change(screen.getByLabelText('Message (optional)'), { target: { value: '  Hello  ' } });

    fireEvent.click(confirmButton());

    await waitFor(() => expect(examinationServiceMock.emailReport).toHaveBeenCalledTimes(1));
    expect(printServiceMock.getPdfBlob).toHaveBeenCalledTimes(1);
    expect(examinationServiceMock.emailReport).toHaveBeenCalledWith('exam-1', {
      recipient_email: 'other@example.com',
      subject: 'Edited subject',
      message: 'Hello',
      file_name: 'MRN-IVAN-2026-000001_2026-11-07.pdf',
      pdf_base64: btoa(PDF_TEXT),
    });
  });

  it('omits recipient_email and message when the profile email is used and no message is typed', async () => {
    renderButton();
    await openDialog();
    await waitFor(() => expect(recipientInput().value).toBe('patient@example.com'));

    fireEvent.click(confirmButton());

    await waitFor(() => expect(examinationServiceMock.emailReport).toHaveBeenCalledTimes(1));
    const body = examinationServiceMock.emailReport.mock.calls[0][1];
    expect(body.recipient_email).toBeUndefined();
    expect(body.message).toBeUndefined();
    expect(body.subject).toBe('Examination report \u2014 Prenatal \u2014 2026-11-07');
  });

  it('sends the typed address when the patient has no profile email', async () => {
    patientServiceMock.getPatient.mockResolvedValue({ patientId: 'patient-1' });
    renderButton();
    await openDialog();
    await screen.findByText('Patient has no email in the profile');
    fireEvent.change(recipientInput(), { target: { value: 'typed@example.com' } });
    fireEvent.click(confirmButton());

    await waitFor(() => expect(examinationServiceMock.emailReport).toHaveBeenCalledTimes(1));
    expect(examinationServiceMock.emailReport.mock.calls[0][1].recipient_email).toBe('typed@example.com');
  });

  it('shows "Report accepted for delivery to {address}" on success', async () => {
    renderButton();
    await openDialog();
    await waitFor(() => expect(recipientInput().value).toBe('patient@example.com'));
    fireEvent.click(confirmButton());

    await screen.findByText('Report accepted for delivery to patient@example.com');
    expect(screen.queryByText(/Report sent/)).toBeNull();
    expect(confirmButton().disabled).toBe(true);
  });

  it('cannot be closed while sending', async () => {
    let release: (blob: unknown) => void = () => {};
    printServiceMock.getPdfBlob.mockReturnValue(
      new Promise((resolve) => {
        release = resolve;
      })
    );
    const { container } = renderButton();
    await openDialog();
    await waitFor(() => expect(recipientInput().value).toBe('patient@example.com'));
    fireEvent.click(confirmButton());
    await screen.findByText('Generating PDF and sending…');

    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(container.ownerDocument.querySelector('.cds--modal.is-visible')).not.toBeNull();
    expect(screen.getByText('Generating PDF and sending…')).toBeTruthy();

    release({ arrayBuffer: async () => new TextEncoder().encode(PDF_TEXT).buffer });
    await screen.findByText('Report accepted for delivery to patient@example.com');
  });

  it.each([
    ['EMAIL_AUTH_FAILED', 'Your mail provider rejected the login. For Google/Yahoo use an app password'],
    ['EMAIL_CONNECTION_FAILED', 'Could not reach your mail server'],
    ['EMAIL_REJECTED', 'Your mail provider rejected the message'],
  ])('maps %s to a non-technical message', async (code, text) => {
    examinationServiceMock.emailReport.mockRejectedValue(serviceError(code));
    renderButton();
    await openDialog();
    await waitFor(() => expect(recipientInput().value).toBe('patient@example.com'));
    fireEvent.click(confirmButton());

    await screen.findByText(text);
    expect(screen.queryByText('raw server text')).toBeNull();
    // The doctor can fix the problem and retry
    expect(confirmButton().disabled).toBe(false);
  });

  it('switches to the not-configured state with the settings link on EMAIL_PROVIDER_NOT_CONFIGURED', async () => {
    examinationServiceMock.emailReport.mockRejectedValue(serviceError('EMAIL_PROVIDER_NOT_CONFIGURED'));
    renderButton();
    await openDialog();
    await waitFor(() => expect(recipientInput().value).toBe('patient@example.com'));
    fireEvent.click(confirmButton());

    await screen.findByRole('link', { name: 'Go to Email Settings' });
    expect(confirmButton().disabled).toBe(true);
  });

  it('shows the server message for errors without a REQ-EML-05 code', async () => {
    examinationServiceMock.emailReport.mockRejectedValue(serviceError(undefined, 'No recipient email available'));
    renderButton();
    await openDialog();
    await waitFor(() => expect(recipientInput().value).toBe('patient@example.com'));
    fireEvent.click(confirmButton());

    await screen.findByText('No recipient email available');
  });

  it('shows a load error and does not allow sending when the provider status cannot be loaded', async () => {
    providerServiceMock.getProvider.mockRejectedValue(new Error('Failed to load email settings'));
    renderButton();
    await openDialog();
    await screen.findByText('Failed to load email settings');
    expect(confirmButton().disabled).toBe(true);
  });
});
