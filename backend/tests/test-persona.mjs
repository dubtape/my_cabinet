import { getPersonaLoader } from '../src/services/persona/personaLoader.js'
import { existsSync } from 'fs'
import path from 'path'

async function test() {
  try {
    // Clear cache to force re-initialization
    const loader = new (await import('../src/services/persona/personaLoader.js')).PersonaLoader()

    // Access the private property indirectly
    const personas = await loader.loadAllPersonas()

    console.log('Personas loaded:', personas.length)
    console.log('Persona IDs:', personas.map(p => p.id))
  } catch (error) {
    console.error('Error:', error)
  }
}

test()
