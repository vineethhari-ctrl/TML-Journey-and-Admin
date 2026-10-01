import { MasterFieldDef } from '../data/masterCatalogue';
import { validateMasterRecordRules } from './recordRules';

export interface FieldValidationResult {
  isValid: boolean;
  error?: string;
  sanitizedValue?: any;
}

export interface RecordValidationResult {
  isValid: boolean;
  errors: Record<string, string>;
  sanitizedRecord: Record<string, any>;
}

/**
 * Validates whether a given year, month (1-12), and day form a legitimate calendar date.
 * Rejects dates like Feb 30, April 31, or invalid leap year dates.
 */
function isValidCalendarDate(year: number, month: number, day: number): boolean {
  if (year < 1900 || year > 2100) return false;
  if (month < 1 || month > 12) return false;
  if (day < 1) return false;

  // Days in each month (month is 1-indexed)
  const isLeapYear = (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
  const daysInMonths = [31, isLeapYear ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

  return day <= daysInMonths[month - 1];
}

/**
 * Master Field Validator:
 * Strictly enforces data types ('date', 'number', 'select', 'boolean', 'text')
 * and constraints for master catalogue records.
 */
export const masterValidationSchema = {
  /**
   * Validates a single field value against its MasterFieldDef schema
   */
  validateField(field: MasterFieldDef, rawValue: any): FieldValidationResult {
    const isValueEmpty =
      rawValue === undefined ||
      rawValue === null ||
      (typeof rawValue === 'string' && rawValue.trim() === '');

    // 1. Mandatory check
    if (field.mandatory && isValueEmpty) {
      return {
        isValid: false,
        error: `${field.label} is required.`,
      };
    }

    // If empty and not mandatory, return sanitized empty value according to type
    if (isValueEmpty) {
      return {
        isValid: true,
        sanitizedValue: field.type === 'number' ? null : field.type === 'boolean' ? false : '',
      };
    }

    // 2. Type-specific enforcement
    switch (field.type) {
      case 'number': {
        const strVal = String(rawValue).trim();
        // Strict numeric regex: allows optional leading minus, digits, and optional decimal point
        const numericRegex = /^-?\d+(\.\d+)?$/;
        if (!numericRegex.test(strVal)) {
          return {
            isValid: false,
            error: `${field.label} must be a valid numeric value (e.g. 10, 45.5).`,
          };
        }

        const numVal = Number(strVal);
        if (isNaN(numVal) || !isFinite(numVal)) {
          return {
            isValid: false,
            error: `${field.label} must be a finite number.`,
          };
        }

        // Min/Max rule checks
        if (field.validation?.min !== undefined && numVal < field.validation.min) {
          return {
            isValid: false,
            error: `${field.label} cannot be less than ${field.validation.min}.`,
          };
        }

        if (field.validation?.max !== undefined && numVal > field.validation.max) {
          return {
            isValid: false,
            error: `${field.label} cannot be greater than ${field.validation.max}.`,
          };
        }

        return {
          isValid: true,
          sanitizedValue: numVal,
        };
      }

      case 'date': {
        const strVal = String(rawValue).trim();
        // Require standard YYYY-MM-DD ISO format
        const isoDateRegex = /^\d{4}-\d{2}-\d{2}$/;
        if (!isoDateRegex.test(strVal)) {
          return {
            isValid: false,
            error: `${field.label} must be in valid YYYY-MM-DD format (e.g. 2026-09-30).`,
          };
        }

        const [yStr, mStr, dStr] = strVal.split('-');
        const year = parseInt(yStr, 10);
        const month = parseInt(mStr, 10);
        const day = parseInt(dStr, 10);

        if (!isValidCalendarDate(year, month, day)) {
          return {
            isValid: false,
            error: `${field.label} contains an invalid calendar date (${strVal}).`,
          };
        }

        // Min date check
        if (field.validation?.minDate && strVal < field.validation.minDate) {
          return {
            isValid: false,
            error: `${field.label} cannot be earlier than ${field.validation.minDate}.`,
          };
        }

        // Max date check
        if (field.validation?.maxDate && strVal > field.validation.maxDate) {
          return {
            isValid: false,
            error: `${field.label} cannot be later than ${field.validation.maxDate}.`,
          };
        }

        return {
          isValid: true,
          sanitizedValue: strVal,
        };
      }

      case 'select': {
        const strVal = String(rawValue).trim();
        const allowedOptions = field.options || [];

        if (allowedOptions.length === 0) {
          return {
            isValid: false,
            error: `Dropdown field ${field.label} has no configured options.`,
          };
        }

        if (!allowedOptions.includes(strVal)) {
          return {
            isValid: false,
            error: `"${strVal}" is not a valid option for ${field.label}. Allowed: ${allowedOptions.join(', ')}.`,
          };
        }

        return {
          isValid: true,
          sanitizedValue: strVal,
        };
      }

      case 'boolean': {
        let boolVal = false;
        if (typeof rawValue === 'boolean') {
          boolVal = rawValue;
        } else {
          const str = String(rawValue).toLowerCase().trim();
          if (str === 'true' || str === 'y' || str === 'yes' || str === '1') {
            boolVal = true;
          } else if (str === 'false' || str === 'n' || str === 'no' || str === '0') {
            boolVal = false;
          } else {
            return {
              isValid: false,
              error: `${field.label} must be a valid boolean value (Yes/No or True/False).`,
            };
          }
        }

        return {
          isValid: true,
          sanitizedValue: boolVal,
        };
      }

      case 'text':
      default: {
        const strVal = String(rawValue).trim();

        if (field.validation?.pattern) {
          try {
            const regex = new RegExp(field.validation.pattern);
            if (!regex.test(strVal)) {
              return {
                isValid: false,
                error:
                  field.validation.customErrorMessage ||
                  `${field.label} does not match the required format (${field.validation.pattern}).`,
              };
            }
          } catch {
            // invalid regex configuration fallback
          }
        }

        return {
          isValid: true,
          sanitizedValue: strVal,
        };
      }
    }
  },

  /**
   * Validates an entire record object against all fields of a master configuration.
   * Returns a list of all errors and a sanitized, properly type-cast record ready for storage.
   */
  validateRecord(
    fields: MasterFieldDef[],
    recordData: Record<string, any>,
    /** Adds the master's cross-field business rules (e.g. EQC: GC Mandatory needs GC Applicable). */
    masterId?: string
  ): RecordValidationResult {
    const errors: Record<string, string> = {};
    const sanitizedRecord: Record<string, any> = { ...recordData };

    fields.forEach((field) => {
      const result = this.validateField(field, recordData[field.key]);
      if (!result.isValid && result.error) {
        errors[field.key] = result.error;
      } else if (result.isValid && result.sanitizedValue !== undefined) {
        sanitizedRecord[field.key] = result.sanitizedValue;
      }
    });

    if (masterId) {
      // Only when every field is individually valid — otherwise the field errors say it better
      if (Object.keys(errors).length === 0) Object.assign(errors, validateMasterRecordRules(masterId, sanitizedRecord));
    }

    return {
      isValid: Object.keys(errors).length === 0,
      errors,
      sanitizedRecord,
    };
  },

  /**
   * Validates the schema definition itself when creating a new custom parameter on the fly.
   */
  validateCustomFieldDefinition(def: {
    label: string;
    key: string;
    type: 'text' | 'number' | 'select' | 'boolean' | 'date';
    optionsString?: string;
    defaultValue?: any;
    min?: number;
    max?: number;
  }): { isValid: boolean; error?: string } {
    if (!def.label.trim()) {
      return { isValid: false, error: 'Field display label is required.' };
    }

    if (def.type === 'select') {
      const options = (def.optionsString || '')
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);

      if (options.length < 2) {
        return {
          isValid: false,
          error: 'Dropdown fields require at least 2 distinct comma-separated options.',
        };
      }

      // Check duplicate options
      const unique = new Set(options);
      if (unique.size !== options.length) {
        return {
          isValid: false,
          error: 'Dropdown options must be unique with no duplicates.',
        };
      }

      // If default value provided, must be in options
      if (def.defaultValue && !options.includes(String(def.defaultValue).trim())) {
        return {
          isValid: false,
          error: `Default value "${def.defaultValue}" must be one of the configured dropdown options.`,
        };
      }
    }

    if (def.type === 'number') {
      if (def.min !== undefined && def.max !== undefined && def.min > def.max) {
        return {
          isValid: false,
          error: `Minimum value (${def.min}) cannot be greater than Maximum value (${def.max}).`,
        };
      }

      if (def.defaultValue !== undefined && String(def.defaultValue).trim() !== '') {
        const num = Number(def.defaultValue);
        if (isNaN(num) || !isFinite(num)) {
          return {
            isValid: false,
            error: 'Default value for Number field must be a valid numeric value.',
          };
        }
      }
    }

    if (def.type === 'date') {
      if (def.defaultValue !== undefined && String(def.defaultValue).trim() !== '') {
        const strVal = String(def.defaultValue).trim();
        const isoDateRegex = /^\d{4}-\d{2}-\d{2}$/;
        if (!isoDateRegex.test(strVal)) {
          return {
            isValid: false,
            error: 'Default date value must be in YYYY-MM-DD format.',
          };
        }
      }
    }

    return { isValid: true };
  },
};
