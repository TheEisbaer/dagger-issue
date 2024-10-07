namespace Test.Steps;

[Binding]
public sealed class StepDefinitions
{
    [Given(@"I wait for over (.*) minutes")]
    public async Task GivenIWaitForOverMinutes(int p0)
    {
        await Task.Delay((int)TimeSpan.FromSeconds(p0+1).TotalMilliseconds);
    }
}