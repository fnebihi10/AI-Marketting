import { useState, type ChangeEvent, type FormEvent } from 'react';
import { createJob, createPhotoJob } from '../lib/api';
import { CampaignKind } from './useJobs';

export type FormState = {
  title: string;
  description: string;
  style: string;
  productCategory: string;
  images: File[];
};

export const useCampaignForm = (
  createMode: CampaignKind,
  onSuccess: (jobId: string) => void,
  onLoadJobs: () => Promise<void>
) => {
  const [form, setForm] = useState<FormState>({
    title: 'New Campaign',
    description: 'Launch teaser for the next campaign',
    style: 'energetic',
    productCategory: 'food-dessert',
    images: [],
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    setForm((current) => ({
      ...current,
      images: [...current.images, ...files].slice(0, 2), // Max 2: one for start, one for end
    }));
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError('');
    setIsSubmitting(true);

    try {
      const title = form.title.trim();
      const description = form.description.trim();
      const style = form.style.trim();
      const productCategory = form.productCategory.trim();

      if (!title || !description || !style || !productCategory) {
        throw new Error('Please complete the title, brief, style, and category.');
      }

      const payload = {
        title,
        description,
        style,
        productCategory,
        images: form.images,
      };

      const created =
        createMode === 'video'
          ? await createJob(payload)
          : await createPhotoJob(payload);

      onSuccess(created._id);
      await onLoadJobs();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create campaign.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return {
    form,
    setForm,
    isSubmitting,
    error,
    handleFileChange,
    handleSubmit,
  };
};
