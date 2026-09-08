'use client';

import { useState, useEffect } from 'react';
import { X, Loader2, Save, ShieldCheck, Eye, EyeOff } from 'lucide-react';
import { AdminProperty, saveProperty } from '@/app/actions';

interface PropertyModalProps {
  isOpen: boolean;
  onClose: () => void;
  property?: AdminProperty | null; // If null, we are creating a new property
  onSuccess: () => void;
}

export function PropertyModal({ isOpen, onClose, property, onSuccess }: PropertyModalProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  
  const [formData, setFormData] = useState({
    accountNumber: '',
    ownerName: '',
    ownerPhone: '',
    ownerDigitalAddress: '',
    physicalAddress: '',
    municipality: 'Kpone-Katamanso (KKMA)',
    propertyClassification: 'PRIVATE THIRD CLASS RESIDENTIAL',
    rateableValue: '0',
    rateImposed: '0.00025',
  });

  useEffect(() => {
    if (property) {
      setFormData({
        accountNumber: property.accountNumber,
        ownerName: property.ownerName,
        ownerPhone: property.ownerPhone,
        ownerDigitalAddress: property.ownerDigitalAddress,
        physicalAddress: '', // Not in AdminProperty yet, but would be loaded here
        municipality: property.municipality,
        propertyClassification: property.propertyClassification,
        rateableValue: property.rateableValue.toString(),
        rateImposed: property.rateImposed.toString(),
      });
    } else {
      setFormData({
        accountNumber: '',
        ownerName: '',
        ownerPhone: '',
        ownerDigitalAddress: '',
        physicalAddress: '',
        municipality: 'Kpone-Katamanso (KKMA)',
        propertyClassification: 'PRIVATE THIRD CLASS RESIDENTIAL',
        rateableValue: '0',
        rateImposed: '0.00025',
      });
    }
    setAdminPassword('');
    setError('');
  }, [property, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adminPassword.trim()) {
      setError('Administrator security password is required to authorize property changes.');
      return;
    }

    setIsLoading(true);
    setError('');
    
    try {
      const res = await saveProperty({
        id: property?.id,
        ...formData,
        rateableValue: parseFloat(formData.rateableValue),
        rateImposed: parseFloat(formData.rateImposed)
      }, adminPassword);
      
      if (res.success) {
        onSuccess();
        onClose();
      } else {
        setError(res.error || 'Failed to save property');
      }
    } catch (err) {
      setError('An unexpected error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/50 backdrop-blur-xs font-sans">
      <div className="bg-white rounded-t-2xl sm:rounded-xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[92vh] sm:max-h-[90vh]">
        <div className="w-10 h-1 bg-[#DADCE0] rounded-full mx-auto my-2 sm:hidden shrink-0" />
        <div className="flex items-center justify-between p-3.5 sm:p-4 border-b border-[#DADCE0] bg-[#F6ECF2]/50 shrink-0">
          <h2 className="font-semibold text-[#2C2C2C] text-sm sm:text-base">
            {property ? 'Edit Property Assessment' : 'Register New Property'}
          </h2>
          <button onClick={onClose} className="p-1 hover:bg-[#E8EAED] rounded-lg transition-colors cursor-pointer">
            <X className="w-5 h-5 text-[#717171]" />
          </button>
        </div>
        
        <div className="p-4 sm:p-6 overflow-y-auto">
          {error && (
            <div className="mb-4 bg-[#FCE8E6] border border-[#FAD2CF] text-[#C5221F] px-4 py-3 rounded-md text-xs">
              {error}
            </div>
          )}
          
          <form id="property-form" onSubmit={handleSubmit} className="space-y-5 sm:space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
              <div>
                <label className="block text-xs font-medium text-[#717171] mb-1">Account Number *</label>
                <input
                  required
                  type="text"
                  value={formData.accountNumber}
                  onChange={(e) => setFormData({ ...formData, accountNumber: e.target.value })}
                  disabled={!!property}
                  className="w-full text-xs p-2.5 sm:p-2 border border-[#DADCE0] rounded-md focus:ring-[#612D53] focus:border-[#612D53] disabled:bg-[#F6ECF2]"
                  placeholder="e.g. KKDA03188007"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-[#717171] mb-1">Municipality</label>
                <select
                  value={formData.municipality}
                  onChange={(e) => setFormData({ ...formData, municipality: e.target.value })}
                  aria-label="Select Municipality"
                  className="w-full text-xs p-2.5 sm:p-2 border border-[#DADCE0] rounded-md focus:ring-[#612D53] focus:border-[#612D53]"
                >
                  <option>Kpone-Katamanso (KKMA)</option>
                  <option>Tema Metropolitan (TMA)</option>
                  <option>Accra Metropolitan (AMA)</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
              <div>
                <label className="block text-xs font-medium text-[#717171] mb-1">Owner Name *</label>
                <input
                  required
                  type="text"
                  value={formData.ownerName}
                  onChange={(e) => setFormData({ ...formData, ownerName: e.target.value })}
                  className="w-full text-xs p-2.5 sm:p-2 border border-[#DADCE0] rounded-md focus:ring-[#612D53]"
                  placeholder="Ratepayer Full Name"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-[#717171] mb-1">Owner Phone *</label>
                <input
                  required
                  type="text"
                  value={formData.ownerPhone}
                  onChange={(e) => setFormData({ ...formData, ownerPhone: e.target.value })}
                  className="w-full text-xs p-2.5 sm:p-2 border border-[#DADCE0] rounded-md focus:ring-[#612D53]"
                  placeholder="024XXXXXXX"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
              <div>
                <label className="block text-xs font-medium text-[#717171] mb-1">Digital Address (GPS)</label>
                <input
                  type="text"
                  value={formData.ownerDigitalAddress}
                  onChange={(e) => setFormData({ ...formData, ownerDigitalAddress: e.target.value })}
                  className="w-full text-xs p-2.5 sm:p-2 border border-[#DADCE0] rounded-md focus:ring-[#612D53]"
                  placeholder="e.g. GK-0010-9395"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-[#717171] mb-1">Physical Location</label>
                <input
                  type="text"
                  value={formData.physicalAddress}
                  onChange={(e) => setFormData({ ...formData, physicalAddress: e.target.value })}
                  className="w-full text-xs p-2.5 sm:p-2 border border-[#DADCE0] rounded-md focus:ring-[#612D53]"
                  placeholder="e.g. Near Community Center"
                />
              </div>
            </div>

            <div className="border-t border-[#DADCE0] pt-4">
              <h3 className="text-xs font-semibold text-[#2C2C2C] mb-3">Assessment &amp; Valuation</h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
                <div className="sm:col-span-1">
                  <label className="block text-xs font-medium text-[#717171] mb-1">Classification *</label>
                  <select
                    value={formData.propertyClassification}
                    onChange={(e) => setFormData({ ...formData, propertyClassification: e.target.value })}
                    aria-label="Select Property Classification"
                    className="w-full text-xs p-2.5 sm:p-2 border border-[#DADCE0] rounded-md focus:ring-[#612D53]"
                  >
                    <option>PRIVATE THIRD CLASS RESIDENTIAL</option>
                    <option>FIRST CLASS RESIDENTIAL</option>
                    <option>COMMERCIAL FIRST CLASS</option>
                    <option>COMMERCIAL MIXED USE</option>
                    <option>INDUSTRIAL</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-[#717171] mb-1">Rateable Value (GH₵) *</label>
                  <input
                    required
                    type="number"
                    min="0"
                    step="0.01"
                    value={formData.rateableValue}
                    onChange={(e) => setFormData({ ...formData, rateableValue: e.target.value })}
                    className="w-full text-xs p-2.5 sm:p-2 border border-[#DADCE0] rounded-md focus:ring-[#612D53]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-[#717171] mb-1">Rate Imposed Factor *</label>
                  <input
                    required
                    type="number"
                    min="0"
                    step="0.00001"
                    value={formData.rateImposed}
                    onChange={(e) => setFormData({ ...formData, rateImposed: e.target.value })}
                    className="w-full text-xs p-2.5 sm:p-2 border border-[#DADCE0] rounded-md focus:ring-[#612D53]"
                  />
                </div>
              </div>
            </div>

            {/* Administrator Security Authorization */}
            <div className="border-t border-[#DADCE0] pt-4 space-y-2 bg-[#F8F9FA] p-3.5 rounded-xl border">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-[#612D53]" />
                <label className="block text-xs font-semibold text-[#2C2C2C]">
                  Administrator Security Authorization *
                </label>
              </div>
              <p className="text-[11px] text-[#717171]">
                Enter your administrator password to authorize cadastral changes.
              </p>
              <div className="relative">
                <input
                  required
                  type={showPassword ? "text" : "password"}
                  value={adminPassword}
                  onChange={(e) => setAdminPassword(e.target.value)}
                  className="w-full text-xs p-2.5 pr-9 border border-[#DADCE0] rounded-lg bg-white focus:outline-none focus:border-[#612D53]"
                  placeholder="Enter administrator password (e.g. admin123)"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#717171] hover:text-[#2C2C2C] p-1 cursor-pointer"
                >
                  {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>
          </form>
        </div>
        
        <div className="p-3.5 sm:p-4 border-t border-[#DADCE0] bg-[#F6ECF2]/50 flex justify-end gap-2.5 sm:gap-3 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="btn-3d-secondary h-11 sm:h-9 px-4 rounded-lg font-medium text-xs cursor-pointer flex-1 sm:flex-none"
          >
            Cancel
          </button>
          <button
            type="submit"
            form="property-form"
            disabled={isLoading}
            className="btn-3d-primary h-11 sm:h-9 px-4 rounded-lg font-medium text-xs flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex-1 sm:flex-none"
          >
            {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            <span>{property ? 'Save Changes' : 'Register Property'}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
