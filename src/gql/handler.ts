import 'source-map-support/register'
import '~/utils/logger'
import { handler } from './apollo'

export const server = handler
