import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { validate, validateBody, validateQuery, validateParams } from '../validation.middleware';

describe('Validation Middleware', () => {
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;
  let mockNext: NextFunction;
  let jsonMock: jest.Mock;
  let statusMock: jest.Mock;

  beforeEach(() => {
    jsonMock = jest.fn();
    statusMock = jest.fn().mockReturnValue({ json: jsonMock });

    mockReq = {
      body: {},
      query: {},
      params: {},
    };

    mockRes = {
      status: statusMock,
      json: jsonMock,
    };

    mockNext = jest.fn();
  });

  describe('validate', () => {
    const userSchema = z.object({
      name: z.string().min(1),
      email: z.string().email(),
      age: z.number().min(0).optional(),
    });

    it('should validate and pass valid body data', () => {
      mockReq.body = {
        name: 'John Doe',
        email: 'john@example.com',
        age: 30,
      };

      const middleware = validate(userSchema, 'body');
      middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith();
      expect(statusMock).not.toHaveBeenCalled();
      expect(mockReq.body).toEqual({
        name: 'John Doe',
        email: 'john@example.com',
        age: 30,
      });
    });

    it('should validate and pass valid query data', () => {
      mockReq.query = {
        name: 'John Doe',
        email: 'john@example.com',
      };

      const middleware = validate(userSchema, 'query');
      middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith();
      expect(statusMock).not.toHaveBeenCalled();
    });

    it('should validate and pass valid params data', () => {
      const idSchema = z.object({
        id: z.string().uuid(),
      });

      mockReq.params = {
        id: '123e4567-e89b-12d3-a456-426614174000',
      };

      const middleware = validate(idSchema, 'params');
      middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith();
      expect(statusMock).not.toHaveBeenCalled();
    });

    it('should reject invalid data and return 400', () => {
      mockReq.body = {
        name: '',
        email: 'invalid-email',
      };

      const middleware = validate(userSchema, 'body');
      middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).not.toHaveBeenCalled();
      expect(statusMock).toHaveBeenCalledWith(400);
      expect(jsonMock).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'Invalid request data',
          details: expect.arrayContaining([
            expect.objectContaining({
              path: expect.any(String),
              message: expect.any(String),
            }),
          ]),
        })
      );
    });

    it('should return detailed validation errors', () => {
      mockReq.body = {
        name: '',
        email: 'not-an-email',
      };

      const middleware = validate(userSchema, 'body');
      middleware(mockReq as Request, mockRes as Response, mockNext);

      const response = jsonMock.mock.calls[0][0];
      expect(response.details).toHaveLength(2);
      expect(response.details).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            path: 'name',
            message: expect.stringContaining('String must contain at least 1 character'),
          }),
          expect.objectContaining({
            path: 'email',
            message: expect.stringContaining('Invalid email'),
          }),
        ])
      );
    });

    it('should apply defaults from schema', () => {
      const schemaWithDefaults = z.object({
        name: z.string(),
        role: z.string().default('user'),
        active: z.boolean().default(true),
      });

      mockReq.body = {
        name: 'John',
      };

      const middleware = validate(schemaWithDefaults, 'body');
      middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockReq.body).toEqual({
        name: 'John',
        role: 'user',
        active: true,
      });
    });

    it('should handle nested object validation', () => {
      const nestedSchema = z.object({
        user: z.object({
          profile: z.object({
            firstName: z.string().min(1),
            lastName: z.string(),
          }),
        }),
      });

      mockReq.body = {
        user: {
          profile: {
            firstName: '',
          },
        },
      };

      const middleware = validate(nestedSchema, 'body');
      middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(statusMock).toHaveBeenCalledWith(400);
      const response = jsonMock.mock.calls[0][0];
      expect(response.details).toContainEqual(
        expect.objectContaining({
          path: 'user.profile.firstName',
        })
      );
      expect(response.details).toContainEqual(
        expect.objectContaining({
          path: 'user.profile.lastName',
        })
      );
    });

    it('should handle array validation errors', () => {
      const arraySchema = z.object({
        tags: z.array(z.string().min(1)),
      });

      mockReq.body = {
        tags: ['valid', '', 'another-valid'],
      };

      const middleware = validate(arraySchema, 'body');
      middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(statusMock).toHaveBeenCalledWith(400);
      const response = jsonMock.mock.calls[0][0];
      expect(response.details[0].path).toBe('tags.1');
    });

    it('should pass non-Zod errors to next middleware', () => {
      const throwingSchema = {
        parse: () => {
          throw new Error('Non-Zod error');
        },
      } as any;

      const middleware = validate(throwingSchema, 'body');
      middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith(expect.any(Error));
      expect(statusMock).not.toHaveBeenCalled();
    });
  });

  describe('validateBody', () => {
    it('should be a convenience wrapper for body validation', () => {
      const schema = z.object({ name: z.string() });
      mockReq.body = { name: 'Test' };

      const middleware = validateBody(schema);
      middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(statusMock).not.toHaveBeenCalled();
    });
  });

  describe('validateQuery', () => {
    it('should be a convenience wrapper for query validation', () => {
      const schema = z.object({ search: z.string() });
      mockReq.query = { search: 'test query' };

      const middleware = validateQuery(schema);
      middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(statusMock).not.toHaveBeenCalled();
    });
  });

  describe('validateParams', () => {
    it('should be a convenience wrapper for params validation', () => {
      const schema = z.object({ id: z.string() });
      mockReq.params = { id: '123' };

      const middleware = validateParams(schema);
      middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(statusMock).not.toHaveBeenCalled();
    });
  });

  describe('edge cases', () => {
    it('should handle empty validation schema', () => {
      const emptySchema = z.object({});
      mockReq.body = { anything: 'goes' };

      const middleware = validate(emptySchema, 'body');
      middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockReq.body).toEqual({});
    });

    it('should handle strict schemas that disallow extra keys', () => {
      const strictSchema = z.object({ name: z.string() }).strict();
      mockReq.body = { name: 'Test', extra: 'field' };

      const middleware = validate(strictSchema, 'body');
      middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(statusMock).toHaveBeenCalledWith(400);
      const response = jsonMock.mock.calls[0][0];
      expect(response.details[0].message).toContain('Unrecognized key');
    });

    it('should transform data types when using coercion', () => {
      const coerceSchema = z.object({
        age: z.coerce.number(),
        active: z.coerce.boolean(),
      });

      mockReq.query = { age: '25', active: '1' };

      const middleware = validate(coerceSchema, 'query');
      middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockReq.query).toEqual({ age: 25, active: true });
    });
  });
});
