from crewai import Agent, Task, Crew
from langchain_ollama import OllamaLLM
# We vertellen de agents om jouw lokale Ollama te gebruiken
llm = Ollama(model="llama3.2")

# 1. De UX/UI Agent (Focus op React & Tailwind)
ux_agent = Agent(
  role='Frontend Designer',
  goal='Ontwerp een sleek dark-mode interface voor een Rubiks Cube app',
  backstory='Je bent een expert in React, Tailwind CSS en Framer Motion.',
  llm=llm
)

# 2. De 3D & Logica Agent (Focus op cubing.js)
logic_agent = Agent(
  role='3D Logic Engineer',
  goal='Integreer cubing.js en de Kociemba solver',
  backstory='Je bent een wiskundig genie gespecialiseerd in Rubiks Cube algoritmes.',
  llm=llm
)

# Taken definiëren
task1 = Task(description='Schrijf de React code voor de 3-staps wizard (Scan, Verify, Solve).', agent=ux_agent, expected_output='Een React component met Tailwind styling.')
task2 = Task(description='Schrijf de logica om de cube state naar de Kociemba solver te sturen.', agent=logic_agent, expected_output='Javascript functies voor de solver integratie.')

# De "Crew" (het team) aan het werk zetten
crew = Crew(
  agents=[ux_agent, logic_agent],
  tasks=[task1, task2],
  verbose=True # Zo zie je in de terminal wat ze tegen elkaar zeggen!
)

result = crew.kickoff()
print(result)
