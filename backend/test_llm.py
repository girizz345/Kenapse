import asyncio
from app.services.llm_service import generate_course

async def test():
    try:
        res = await generate_course("Quantum Computing", "Beginner", 5)
        print("SUCCESS:", res)
    except Exception as e:
        print("ERROR:", str(e))
        import traceback
        traceback.print_exc()

asyncio.run(test())
