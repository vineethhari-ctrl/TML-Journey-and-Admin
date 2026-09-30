import React, { useState, useEffect } from 'react';
import { Modal } from '../common/Modal';
import { AppUser, UserType, UserStatus } from '../../types';
import { userService } from '../../services/userService';
import { useApp } from '../../context/AppContext';
import { Sparkles, Info } from 'lucide-react';

interface UserModalProps {
  userToEdit?: AppUser | null;
  isOpen: boolean;
  onClose: () => void;
}

export const UserModal: React.FC<UserModalProps> = ({ userToEdit, isOpen, onClose }) => {
  const { createUser, updateUser, roles } = useApp();

  const [employeeId, setEmployeeId] = useState('');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [mobile, setMobile] = useState('');
  const [userType, setUserType] = useState<UserType>('NON-CRM');
  const [generatedUserId, setGeneratedUserId] = useState('');
  const [department, setDepartment] = useState('Workshop Quality & EQC');
  const [zone, setZone] = useState('West');
  const [region, setRegion] = useState('Maharashtra');
  const [dealer, setDealer] = useState('Tata Motors - Andheri');
  const [workshop, setWorkshop] = useState('Bay 04 High-Voltage Lab');
  const [role, setRole] = useState('Service Advisor');
  const [status, setStatus] = useState<UserStatus>('ACTIVE');
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (userToEdit) {
      setEmployeeId(userToEdit.employeeId);
      setName(userToEdit.name);
      setEmail(userToEdit.email);
      setMobile(userToEdit.mobile);
      setUserType(userToEdit.userType);
      setGeneratedUserId(userToEdit.userId);
      setDepartment(userToEdit.department);
      setZone(userToEdit.zone);
      setRegion(userToEdit.region);
      setDealer(userToEdit.dealer);
      setWorkshop(userToEdit.workshop);
      setRole(userToEdit.role);
      setStatus(userToEdit.status);
    } else {
      // Default new user form
      const nextEmp = `TML${Math.floor(20000 + Math.random() * 80000)}`;
      setEmployeeId(nextEmp);
      setName('');
      setEmail('');
      setMobile('+91 98200 ');
      setUserType('NON-CRM');
      setGeneratedUserId(userService.generateUserId('NON-CRM', 'MH'));
      setDepartment('Service Operations');
      setZone('West');
      setRegion('Maharashtra');
      setDealer('Tata Motors - Andheri');
      setWorkshop('Central Workshop Bay 1');
      setRole('Service Advisor');
      setStatus('ACTIVE');
    }
    setErrors({});
  }, [userToEdit, isOpen]);

  // Handle userType change
  const handleUserTypeChange = (newType: UserType) => {
    setUserType(newType);
    if (!userToEdit) {
      setGeneratedUserId(userService.generateUserId(newType, region.slice(0, 2)));
    }
  };

  const handleRegenerateId = () => {
    setGeneratedUserId(userService.generateUserId(userType, region.slice(0, 2)));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const newErrors: Record<string, string> = {};

    if (!employeeId.trim()) newErrors.employeeId = 'Employee ID is required';
    if (!name.trim()) newErrors.name = 'Employee Name is required';
    if (!email.trim()) {
      newErrors.email = 'Email address is required';
    } else if (!userService.validateEmail(email)) {
      newErrors.email = 'Please provide a valid email format';
    }
    if (!role) newErrors.role = 'Role selection is mandatory';

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    if (userToEdit) {
      updateUser(userToEdit.userId, {
        name,
        email,
        mobile,
        department,
        zone,
        region,
        dealer,
        workshop,
        role,
        status,
        userType,
      });
    } else {
      createUser({
        employeeId: employeeId.trim(),
        name: name.trim(),
        userId: generatedUserId,
        email: email.trim(),
        mobile: mobile.trim(),
        userType,
        department,
        zone,
        region,
        dealer,
        workshop,
        role,
        status,
      });
    }

    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={userToEdit ? `Edit User: ${userToEdit.userId}` : 'Create New User / Employee'}
      subtitle="Identity & Access Governance"
      maxWidth="2xl"
    >
      <form onSubmit={handleSubmit} className="space-y-4 text-xs">
        {/* User Type & Auto ID Banner */}
        <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <label className="font-bold text-slate-800 uppercase tracking-wider text-[11px] block">
                User Type *
              </label>
              <div className="flex items-center gap-4 mt-1.5">
                {(['CRM', 'NON-CRM', 'ADMIN'] as UserType[]).map((t) => (
                  <label key={t} className="flex items-center gap-1.5 cursor-pointer font-medium text-slate-700">
                    <input
                      type="radio"
                      name="userType"
                      value={t}
                      checked={userType === t}
                      onChange={() => handleUserTypeChange(t)}
                      className="accent-blue-600"
                    />
                    <span>
                      {t === 'CRM' ? 'CRM User' : t === 'NON-CRM' ? 'Non-CRM User' : 'Administrator'}
                    </span>
                  </label>
                ))}
              </div>
            </div>

            {/* Auto User ID */}
            <div className="flex items-center gap-2">
              <div>
                <span className="text-slate-400 block text-[10px] uppercase font-semibold">
                  Generated User ID
                </span>
                <span className="font-mono font-bold text-blue-900 text-sm">
                  {generatedUserId}
                </span>
              </div>
              {!userToEdit && (
                <button
                  type="button"
                  onClick={handleRegenerateId}
                  className="p-1 text-slate-400 hover:text-blue-600 rounded hover:bg-slate-200"
                  title="Generate new ID"
                >
                  <Sparkles className="h-4 w-4" />
                </button>
              )}
            </div>
          </div>

          <div className="flex items-center gap-1.5 text-[11px] text-slate-500 bg-white/80 p-2 rounded border border-slate-200">
            <Info className="h-3.5 w-3.5 text-blue-600 shrink-0" />
            <span>
              {userType === 'CRM'
                ? 'CRM user identity is linked to enterprise/CRM identity.'
                : userType === 'NON-CRM'
                ? 'Non-CRM User ID generated automatically by Service Transformation.'
                : 'Administrator account with high privilege access.'}
            </span>
          </div>
        </div>

        {/* Identity row 1 */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
          <div>
            <label className="font-semibold text-slate-700 block mb-1">
              Employee ID *
            </label>
            <input
              type="text"
              value={employeeId}
              onChange={(e) => setEmployeeId(e.target.value)}
              placeholder="e.g. TML10294"
              className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-white font-mono focus:border-blue-500 focus:outline-hidden"
            />
            {errors.employeeId && (
              <p className="text-rose-600 text-[11px] mt-0.5">{errors.employeeId}</p>
            )}
          </div>

          <div>
            <label className="font-semibold text-slate-700 block mb-1">
              Employee Name *
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Priya Shinde"
              className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-white focus:border-blue-500 focus:outline-hidden"
            />
            {errors.name && (
              <p className="text-rose-600 text-[11px] mt-0.5">{errors.name}</p>
            )}
          </div>
        </div>

        {/* Identity row 2 */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
          <div>
            <label className="font-semibold text-slate-700 block mb-1">
              Corporate Email *
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="name@tatamotors.com"
              className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-white focus:border-blue-500 focus:outline-hidden"
            />
            {errors.email && (
              <p className="text-rose-600 text-[11px] mt-0.5">{errors.email}</p>
            )}
          </div>

          <div>
            <label className="font-semibold text-slate-700 block mb-1">
              Mobile Number
            </label>
            <input
              type="text"
              value={mobile}
              onChange={(e) => setMobile(e.target.value)}
              placeholder="+91 98200 00000"
              className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-white focus:border-blue-500 focus:outline-hidden"
            />
          </div>
        </div>

        {/* Role & Status */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
          <div>
            <label className="font-semibold text-slate-700 block mb-1">
              Assigned Role *
            </label>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-white font-medium focus:border-blue-500 focus:outline-hidden cursor-pointer"
            >
              {roles.map((r) => (
                <option key={r.id} value={r.name}>
                  {r.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="font-semibold text-slate-700 block mb-1">
              Account Status
            </label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as UserStatus)}
              className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-white font-medium focus:border-blue-500 focus:outline-hidden cursor-pointer"
            >
              <option value="ACTIVE">ACTIVE</option>
              <option value="INACTIVE">INACTIVE</option>
              <option value="SUSPENDED">SUSPENDED</option>
              <option value="LOCKED">LOCKED</option>
              <option value="PENDING">PENDING</option>
            </select>
          </div>
        </div>

        {/* Organizational Assignment */}
        <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-3">
          <p className="font-bold text-slate-800 uppercase tracking-wider text-[11px]">
            Dealership & Facility Assignment
          </p>

          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            <div>
              <label className="font-medium text-slate-600 block mb-1">Zone</label>
              <select
                value={zone}
                onChange={(e) => setZone(e.target.value)}
                className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white focus:outline-hidden"
              >
                <option value="West">West</option>
                <option value="North">North</option>
                <option value="South">South</option>
                <option value="East">East</option>
              </select>
            </div>

            <div>
              <label className="font-medium text-slate-600 block mb-1">Region</label>
              <input
                type="text"
                value={region}
                onChange={(e) => setRegion(e.target.value)}
                className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white focus:outline-hidden"
              />
            </div>

            <div>
              <label className="font-medium text-slate-600 block mb-1">Department</label>
              <input
                type="text"
                value={department}
                onChange={(e) => setDepartment(e.target.value)}
                className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white focus:outline-hidden"
              />
            </div>

            <div className="col-span-2">
              <label className="font-medium text-slate-600 block mb-1">Dealer</label>
              <input
                type="text"
                value={dealer}
                onChange={(e) => setDealer(e.target.value)}
                className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white focus:outline-hidden"
              />
            </div>

            <div>
              <label className="font-medium text-slate-600 block mb-1">Workshop / Bay</label>
              <input
                type="text"
                value={workshop}
                onChange={(e) => setWorkshop(e.target.value)}
                className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white focus:outline-hidden"
              />
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-semibold transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            className="px-5 py-2 rounded-lg bg-blue-900 hover:bg-blue-800 text-white font-semibold transition-colors shadow-xs"
          >
            {userToEdit ? 'Save Changes' : 'Create User'}
          </button>
        </div>
      </form>
    </Modal>
  );
};
