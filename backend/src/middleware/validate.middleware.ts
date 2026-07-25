import type { NextFunction, Request, Response } from 'express'
import type { ZodType } from 'zod'

type Schemas = {
  body?: ZodType
  query?: ZodType
  params?: ZodType
}

export function validate(schemas: Schemas) {
  return (req: Request, _res: Response, next: NextFunction) => {
    try {
      if (schemas.body) req.body = schemas.body.parse(req.body)
      if (schemas.query) Object.assign(req.query, schemas.query.parse(req.query))
      if (schemas.params) Object.assign(req.params, schemas.params.parse(req.params))
      return next()
    } catch (error) {
      return next(error)
    }
  }
}
