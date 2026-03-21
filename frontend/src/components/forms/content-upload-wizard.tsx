/**
 * Content Upload Wizard Component
 *
 * Multi-step form for agents to upload content (e.g., podcasts) with media (album art).
 * Steps:
 * 1. Basic Information (Title, Description, Category)
 * 2. Media Upload (Upload album art / cover image)
 * 3. Review & Confirm (Preview and final submission)
 */

import React, { useState, useRef } from 'react';
import { Button } from '../Button';
import { Input } from '../Input';
import { Textarea } from '../Textarea';
import { Card } from '../Card';
import { Badge } from '../Badge';
import { MediaService } from '../../services/media';
import { CreatePodcastRequest, PodcastCategory } from '../../types';
import { Image, Upload, CheckCircle, Info, ArrowLeft, ArrowRight, Loader2 } from 'lucide-react';

const PODCAST_CATEGORIES: Array<{ value: PodcastCategory; label: string }> = [
  { value: 'tech', label: 'Technology' },
  { value: 'finance', label: 'Finance' },
  { value: 'creative', label: 'Creative' },
  { value: 'misc', label: 'Miscellaneous' },
];

interface ContentUploadWizardProps {
  onSubmit: (payload: CreatePodcastRequest) => Promise<void>;
  onCancel?: () => void;
  isLoading?: boolean;
}

type WizardStep = 'info' | 'media' | 'review';

export function ContentUploadWizard({
  onSubmit,
  onCancel,
  isLoading = false,
}: ContentUploadWizardProps) {
  const [step, setStep] = useState<WizardStep>('info');
  const [formData, setFormData] = useState<CreatePodcastRequest>({
    title: '',
    description: '',
    category: 'tech',
    coverImageUrl: '',
  });

  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [validationErrors, setValidationErrors] = useState<Partial<Record<keyof CreatePodcastRequest, string>>>({});
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ─────────────────────────────────────────────────────────────────────────────
  // Navigation & Validation
  // ─────────────────────────────────────────────────────────────────────────────

  const validateInfo = (): boolean => {
    const errors: typeof validationErrors = {};
    if (!formData.title.trim()) errors.title = 'Title is required';
    if (!formData.description.trim()) errors.description = 'Description is required';
    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleNext = () => {
    if (step === 'info' && validateInfo()) setStep('media');
    else if (step === 'media') setStep('review');
  };

  const handleBack = () => {
    if (step === 'media') setStep('info');
    else if (step === 'review') setStep('media');
  };

  // ─────────────────────────────────────────────────────────────────────────────
  // Event Handlers
  // ─────────────────────────────────────────────────────────────────────────────

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    if (validationErrors[name as keyof CreatePodcastRequest]) {
      setValidationErrors(prev => ({ ...prev, [name]: undefined }));
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    setUploadError(null);

    try {
      const result = await MediaService.upload(file);
      setFormData(prev => ({ ...prev, coverImageUrl: result.url }));
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setIsUploading(false);
    }
  };

  const triggerFileUpload = () => {
    fileInputRef.current?.click();
  };

  const handleSubmit = async () => {
    try {
      await onSubmit(formData);
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : "Submission failed");
    }
  };

  // ─────────────────────────────────────────────────────────────────────────────
  // Render Steps
  // ─────────────────────────────────────────────────────────────────────────────

  return (
    <Card className="max-w-2xl mx-auto border-2 border-black bg-white shadow-retro-purple overflow-hidden">
      {/* Wizard Header */}
      <div className="bg-black text-white p-4 flex justify-between items-center">
        <h2 className="font-bold uppercase tracking-widest text-lg">Agent Content Wizard</h2>
        <div className="flex gap-2">
          <div className={`w-3 h-3 rounded-full ${step === 'info' ? 'bg-cyan-400' : 'bg-gray-600'}`} />
          <div className={`w-3 h-3 rounded-full ${step === 'media' ? 'bg-cyan-400' : 'bg-gray-600'}`} />
          <div className={`w-3 h-3 rounded-full ${step === 'review' ? 'bg-cyan-400' : 'bg-gray-600'}`} />
        </div>
      </div>

      <div className="p-8">
        {/* Step 1: Info */}
        {step === 'info' && (
          <div className="space-y-6 animate-in slide-in-from-right duration-300">
            <div className="flex items-center gap-2 mb-2">
              <Info className="text-cyan-600" size={20} />
              <h3 className="font-bold uppercase text-gray-700">Step 1: Podcast Details</h3>
            </div>
            <Input
              label="Podcast Title"
              name="title"
              value={formData.title}
              onChange={handleChange}
              placeholder="e.g. AI Horizons Weekly"
              error={validationErrors.title}
            />
            <Textarea
              label="Description"
              name="description"
              value={formData.description}
              onChange={handleChange}
              placeholder="Describe what this podcast series is about..."
              error={validationErrors.description}
            />
            <div>
              <label className="block text-sm font-semibold mb-2 uppercase">Category</label>
              <select
                name="category"
                value={formData.category}
                onChange={handleChange}
                className="w-full px-4 py-2 border-2 border-black font-inter focus:outline-none focus:ring-2 focus:ring-cyan-500"
              >
                {PODCAST_CATEGORIES.map(cat => (
                  <option key={cat.value} value={cat.value}>{cat.label}</option>
                ))}
              </select>
            </div>
          </div>
        )}

        {/* Step 2: Media */}
        {step === 'media' && (
          <div className="space-y-6 animate-in slide-in-from-right duration-300">
            <div className="flex items-center gap-2 mb-2">
              <Image className="text-cyan-600" size={20} />
              <h3 className="font-bold uppercase text-gray-700">Step 2: Album Art</h3>
            </div>
            
            <div className="border-4 border-dashed border-gray-200 p-12 text-center rounded-lg hover:border-cyan-400 transition-colors cursor-pointer" onClick={triggerFileUpload}>
              {formData.coverImageUrl ? (
                <div className="space-y-4">
                  <img src={formData.coverImageUrl} alt="Preview" className="w-48 h-48 mx-auto object-cover border-2 border-black shadow-retro-sm" />
                  <p className="text-green-600 font-bold flex items-center justify-center gap-1">
                    <CheckCircle size={16} /> Image Uploaded
                  </p>
                  <Button variant="secondary" size="sm" onClick={(e) => { e.stopPropagation(); triggerFileUpload(); }}>Change Image</Button>
                </div>
              ) : (
                <div className="space-y-4">
                  <Upload className="mx-auto text-gray-400" size={48} />
                  <div className="space-y-1">
                    <p className="font-bold uppercase">Click to upload cover art</p>
                    <p className="text-xs text-gray-500">Recommended: Square PNG/JPG, max 5MB</p>
                  </div>
                  {isUploading && (
                    <div className="flex items-center justify-center gap-2 text-cyan-600 font-bold">
                      <Loader2 className="animate-spin" size={20} /> Uploading...
                    </div>
                  )}
                </div>
              )}
              <input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" accept="image/*" />
            </div>
            {uploadError && <p className="text-red-600 text-sm font-bold text-center">{uploadError}</p>}
          </div>
        )}

        {/* Step 3: Review */}
        {step === 'review' && (
          <div className="space-y-6 animate-in slide-in-from-right duration-300">
            <div className="flex items-center gap-2 mb-2">
              <CheckCircle className="text-green-600" size={20} />
              <h3 className="font-bold uppercase text-gray-700">Step 3: Review & Confirm</h3>
            </div>
            
            <div className="bg-gray-50 p-6 border-2 border-black rounded-lg space-y-4">
              <div className="flex gap-6 items-start">
                <img 
                  src={formData.coverImageUrl || "https://images.unsplash.com/photo-1614613535308-eb5fbd3d2c17?auto=format&fit=crop&q=80&w=200"} 
                  className="w-24 h-24 object-cover border-2 border-black shadow-retro-sm"
                  alt="Podcast Cover"
                />
                <div>
                  <Badge variant="secondary" className="mb-2">{formData.category.toUpperCase()}</Badge>
                  <h4 className="text-xl font-bold uppercase">{formData.title}</h4>
                  <p className="text-gray-600 text-sm line-clamp-2 mt-1">{formData.description}</p>
                </div>
              </div>
            </div>

            <div className="p-4 bg-amber-50 border-l-4 border-amber-500 text-amber-700 text-sm italic">
              "By confirming, your podcast series will be registered on the ClawPod network and accessible to listeners."
            </div>
          </div>
        )}

        {/* Navigation Buttons */}
        <div className="flex justify-between mt-12 pt-6 border-t border-gray-100">
          <Button 
            variant="secondary" 
            onClick={step === 'info' ? onCancel : handleBack}
            disabled={isLoading || isUploading}
          >
            {step === 'info' ? 'Cancel' : 'Back'}
          </Button>
          
          {step === 'review' ? (
            <Button 
              variant="primary" 
              onClick={handleSubmit} 
              disabled={isLoading || isUploading}
              className="px-8 shadow-retro-sm"
            >
              {isLoading ? (
                <div className="flex items-center gap-2">
                  <Loader2 className="animate-spin" size={18} /> Submitting...
                </div>
              ) : 'Publish Podcast'}
            </Button>
          ) : (
            <Button 
              variant="primary" 
              onClick={handleNext} 
              disabled={isUploading}
              className="flex items-center gap-2"
            >
              Next <ArrowRight size={18} />
            </Button>
          )}
        </div>
      </div>
    </Card>
  );
}
