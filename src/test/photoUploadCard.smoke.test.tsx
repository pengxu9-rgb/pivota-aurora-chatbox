import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { PhotoUploadCard } from '@/components/chat/cards/PhotoUploadCard';

type MockFace = { boundingBox?: { x: number; y: number; width: number; height: number } };

let detectImpl: (source: unknown) => Promise<MockFace[]> = async () => [];
let originalFaceDetector: unknown;
let originalImage: unknown;
let originalCreateObjectURL: ((obj: Blob | MediaSource) => string) | undefined;
let originalRevokeObjectURL: ((url: string) => void) | undefined;

class MockFaceDetector {
  detect(source: unknown): Promise<MockFace[]> {
    return detectImpl(source);
  }
}

class MockImage {
  onload: ((this: GlobalEventHandlers, ev: Event) => any) | null = null;
  onerror: ((this: GlobalEventHandlers, ev: Event | string) => any) | null = null;
  naturalWidth = 1200;
  naturalHeight = 1200;
  width = 1200;
  height = 1200;
  set src(_value: string) {
    setTimeout(() => {
      if (this.onload) this.onload(new Event('load'));
    }, 0);
  }
}

beforeAll(() => {
  originalFaceDetector = (window as any).FaceDetector;
  originalImage = (globalThis as any).Image;
  originalCreateObjectURL = URL.createObjectURL;
  originalRevokeObjectURL = URL.revokeObjectURL;

  (window as any).FaceDetector = MockFaceDetector;
  (globalThis as any).Image = MockImage;
  URL.createObjectURL = vi.fn(() => 'blob:photo-upload-smoke');
  URL.revokeObjectURL = vi.fn();
});

afterAll(() => {
  if (originalFaceDetector === undefined) {
    delete (window as any).FaceDetector;
  } else {
    (window as any).FaceDetector = originalFaceDetector;
  }

  if (originalImage === undefined) {
    delete (globalThis as any).Image;
  } else {
    (globalThis as any).Image = originalImage;
  }

  if (originalCreateObjectURL) URL.createObjectURL = originalCreateObjectURL;
  if (originalRevokeObjectURL) URL.revokeObjectURL = originalRevokeObjectURL;
});

beforeEach(() => {
  detectImpl = async () => [];
});

function uploadToFirstSlot(container: HTMLElement) {
  const fileInputs = Array.from(container.querySelectorAll('input[type="file"]')) as HTMLInputElement[];
  expect(fileInputs.length).toBeGreaterThan(0);
  const file = new File(['face'], 'face.jpg', { type: 'image/jpeg' });
  fireEvent.change(fileInputs[0], { target: { files: [file] } });
}

describe('PhotoUploadCard smoke', () => {
  it('requires second confirmation only for severe-bad frame', async () => {
    detectImpl = async () => [];
    const onAction = vi.fn();
    const { container } = render(<PhotoUploadCard onAction={onAction} language="EN" />);

    uploadToFirstSlot(container);

    await screen.findByText('High drift risk');

    fireEvent.click(screen.getByRole('checkbox'));
    fireEvent.click(screen.getByRole('button', { name: 'Upload photo' }));

    expect(onAction).not.toHaveBeenCalled();
    expect(screen.getByText('Some photos are outside the guide frame.')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Continue anyway' }));

    expect(onAction).toHaveBeenCalledTimes(1);
    expect(onAction).toHaveBeenCalledWith(
      'photo_upload',
      expect.objectContaining({
        consent: true,
        photos: expect.objectContaining({
          daylight: expect.objectContaining({
            frameCheck: expect.objectContaining({
              level: 'bad',
            }),
          }),
        }),
      })
    );
  });

  it('warn frame shows banner but uploads on first click', async () => {
    detectImpl = async () => [
      {
        boundingBox: {
          x: 50,
          y: 350,
          width: 500,
          height: 500,
        },
      },
    ];

    const onAction = vi.fn();
    const { container } = render(<PhotoUploadCard onAction={onAction} language="EN" />);

    uploadToFirstSlot(container);

    await screen.findByText('Usable but off');
    fireEvent.click(screen.getByRole('checkbox'));
    fireEvent.click(screen.getByRole('button', { name: 'Upload photo' }));

    await waitFor(() => expect(onAction).toHaveBeenCalledTimes(1));
    expect(screen.queryByText('Some photos are outside the guide frame.')).not.toBeInTheDocument();
  });

  it('keeps both photo slots visible so the second lighting shot is immediately available', async () => {
    detectImpl = async () => [
      {
        boundingBox: {
          x: 180,
          y: 180,
          width: 720,
          height: 720,
        },
      },
    ];

    const onAction = vi.fn();
    const { container } = render(<PhotoUploadCard onAction={onAction} language="EN" />);

    expect(screen.getByText('One clear photo is all you need to start')).toBeInTheDocument();
    expect(
      screen.getByText('One clear photo is enough to get started. A second under different lighting can improve accuracy.')
    ).toBeInTheDocument();
    expect(screen.getByText('Add a second photo under different lighting for better accuracy (optional)')).toBeInTheDocument();

    const initialFileInputs = Array.from(container.querySelectorAll('input[type="file"]')) as HTMLInputElement[];
    expect(initialFileInputs.length).toBe(2);

    uploadToFirstSlot(container);

    await screen.findByText('Frame good');

    const fileInputs = Array.from(container.querySelectorAll('input[type="file"]')) as HTMLInputElement[];
    expect(fileInputs.length).toBe(2);
    fireEvent.change(fileInputs[1], { target: { files: [new File(['indoor'], 'indoor.jpg', { type: 'image/jpeg' })] } });

    await screen.findByAltText('indoor_white');
    await screen.findAllByText('Frame good');
  });

  it('keeps skip and upload on one row and removes sample-photo fallback', async () => {
    detectImpl = async () => [
      {
        boundingBox: {
          x: 180,
          y: 180,
          width: 720,
          height: 720,
        },
      },
    ];

    const onAction = vi.fn();
    const { container } = render(<PhotoUploadCard onAction={onAction} language="EN" />);

    const skipButton = screen.getByRole('button', { name: 'Skip photos' });
    const uploadButton = screen.getByRole('button', { name: 'Upload photo' });

    expect(skipButton.parentElement).toBe(uploadButton.parentElement);
    expect(uploadButton).toBeDisabled();
    expect(screen.queryByRole('button', { name: 'Try sample photos' })).not.toBeInTheDocument();
    expect(skipButton.parentElement?.lastElementChild).toBe(uploadButton);

    uploadToFirstSlot(container);
    await screen.findByText('Frame good');
    fireEvent.click(screen.getByRole('checkbox'));

    expect(uploadButton).toBeEnabled();
  });
});
